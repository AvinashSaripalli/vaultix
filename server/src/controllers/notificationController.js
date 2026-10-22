const prisma = require('../config/prisma');

function formatActivityTitle(action) {
  const map = {
    CREATE_FOLDER: 'Folder created',
    UPDATE_FOLDER: 'Folder updated',
    DELETE_FOLDER: 'Folder deleted',
    RESTORE_FOLDER: 'Folder restored',
    CREATE_PASSWORD: 'Password added',
    UPDATE_PASSWORD: 'Password updated',
    DELETE_PASSWORD: 'Password deleted',
    RESTORE_PASSWORD: 'Password restored',
    VIEW_PASSWORD: 'Password viewed',
    COPY_PASSWORD: 'Password copied',
    AUTOFILL_PASSWORD: 'Password autofilled',
    SHARE_PASSWORD: 'Password shared',
    REVOKE_PASSWORD_SHARE: 'Password share revoked',
    SHARE_FOLDER: 'Folder shared',
    REVOKE_FOLDER_ACCESS: 'Folder access revoked',
    CREATE_VAULT: 'Vault created',
    UPDATE_VAULT: 'Vault updated',
    DELETE_VAULT: 'Vault deleted',
    LOGIN: 'Login',
    REGISTER: 'Account registered',
    IMPORT_PASSWORDS: 'Passwords imported',
    SHARE_VAULT: 'Vault shared',
  };
  return map[action] || action?.replaceAll('_', ' ') || 'Activity';
}

const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getRecentNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Recent notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

    // Fetch user's notification read pointer and individual read IDs
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastReadNotificationAt: true, readNotificationIds: true },
    }).catch(() => null);

    // If user hasn't marked anything read yet, default to 24 hours ago so recent collaborator activity is visible
    const defaultPast = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastReadAt = user?.lastReadNotificationAt ? new Date(user.lastReadNotificationAt) : defaultPast;
    const readIdsSet = new Set(Array.isArray(user?.readNotificationIds) ? user.readNotificationIds : []);

    const activityWhere = isAdmin ? {} : { userId };
    const loginWhere = isAdmin ? {} : { userId };

    let [activityLogs, loginActivities, notifications] = await Promise.all([
      prisma.activityLog.findMany({
        where: activityWhere,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.loginActivity.findMany({
        where: loginWhere,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    if (isAdmin) {
      activityLogs = activityLogs.filter((log) => !(log.metadata?.personalVault && log.userId !== userId));
    }

    const items = [
      ...activityLogs.map((log) => {
        const itemId = `activity-${log.id}`;
        // Option A: Actions performed by the user themselves are already seen/read.
        // Actions performed by other collaborators are unread if created after lastReadAt.
        const isSelf = log.userId === userId;
        const isMarkedRead = readIdsSet.has(itemId) || new Date(log.createdAt) <= lastReadAt;
        const isRead = isSelf || isMarkedRead;

        return {
          id: itemId,
          sourceId: log.id,
          type: 'ACTIVITY',
          title: log.action === 'COPY_PASSWORD' && log.metadata?.mode === 'autofill'
            ? 'Password autofilled'
            : formatActivityTitle(log.action),
          message: log.metadata?.name
            ? log.metadata.name
            : log.targetId || '',
          isRead,
          createdAt: log.createdAt,
          meta: { action: log.action, ...(log.metadata || {}), actor: log.user?.fullName || log.user?.email },
        };
      }),
      ...loginActivities.map((item) => {
        const itemId = `login-${item.id}`;
        const userName = item.user?.fullName || item.user?.email || 'Unknown';
        const isSelf = item.userId === userId;
        const isFailed = item.status !== 'SUCCESS';

        // Failed login is a security alert -> unread if after lastReadAt.
        // Self success login is already read.
        // Another user's login is unread if after lastReadAt.
        let isRead = readIdsSet.has(itemId) || new Date(item.createdAt) <= lastReadAt;
        if (isSelf && !isFailed) {
          isRead = true;
        }

        return {
          id: itemId,
          sourceId: item.id,
          type: 'LOGIN',
          title:
            item.status === 'SUCCESS'
              ? `Login: ${userName}`
              : `Failed login: ${userName}`,
          message: `IP: ${item.ipAddress || 'Unknown'}${item.userAgent ? ' · ' + item.userAgent.split(' ')[0] : ''}`,
          isRead,
          createdAt: item.createdAt,
          meta: { status: item.status, ipAddress: item.ipAddress, userAgent: item.userAgent, user: userName },
        };
      }),
      ...notifications.map((n) => {
        const itemId = `notif-${n.id}`;
        const isRead = n.isRead || readIdsSet.has(itemId) || new Date(n.createdAt) <= lastReadAt;

        return {
          id: itemId,
          sourceId: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead,
          createdAt: n.createdAt,
          meta: n.metadata,
        };
      }),
    ];

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const recent = items.slice(0, 30);
    const unreadCount = items.filter((i) => !i.isRead).length;

    res.json({ items: recent, unreadCount, unreadNotifCount: unreadCount });
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const rawId = req.params.id; // e.g. "notif-123" or "activity-456" or "login-789"
    const userId = req.user.id;

    if (rawId.startsWith('notif-')) {
      const notifId = rawId.replace('notif-', '');
      await prisma.notification.updateMany({
        where: {
          id: notifId,
          userId,
        },
        data: {
          isRead: true,
        },
      }).catch(() => null);
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { readNotificationIds: true },
      });
      const currentIds = Array.isArray(user?.readNotificationIds) ? user.readNotificationIds : [];
      if (!currentIds.includes(rawId)) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            readNotificationIds: [...currentIds, rawId],
          },
        });
      }
    } catch {
      // ignore if column not available
    }

    res.json({
      message: 'Notification marked as read',
      id: rawId,
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    await Promise.all([
      prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      }).catch(() => null),
      prisma.user.update({
        where: { id: userId },
        data: {
          lastReadNotificationAt: now,
          readNotificationIds: [],
        },
      }).catch(() => null),
    ]);

    res.json({
      message: 'All notifications marked as read',
      lastReadAt: now,
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getNotifications,
  getRecentNotifications,
  getRecentActivity,
  markNotificationRead,
  markAllNotificationsRead,
};
