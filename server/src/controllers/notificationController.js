const prisma = require('../config/prisma');

function formatActivityTitle(action) {
  const map = {
    CREATE_FOLDER: 'Folder created',
    UPDATE_FOLDER: 'Folder updated',
    DELETE_FOLDER: 'Folder deleted',
    CREATE_PASSWORD: 'Password added',
    UPDATE_PASSWORD: 'Password updated',
    DELETE_PASSWORD: 'Password deleted',
    VIEW_PASSWORD: 'Password viewed',
    COPY_PASSWORD: 'Password copied',
    SHARE_PASSWORD: 'Password shared',
    SHARE_FOLDER: 'Folder shared',
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
    const isAdmin = ['OWNER', 'ADMIN'].includes(req.user.role);
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : null;

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
        const isRead = sinceDate ? new Date(log.createdAt) <= sinceDate : false;

        return {
          id: `activity-${log.id}`,
          sourceId: log.id,
          type: 'ACTIVITY',
          title: formatActivityTitle(log.action),
          message: log.metadata?.name
            ? log.metadata.name
            : log.targetId || '',
          isRead,
          createdAt: log.createdAt,
          meta: { action: log.action },
        };
      }),
      ...loginActivities.map((item) => {
        const isRead = sinceDate
          ? new Date(item.createdAt) <= sinceDate
          : false;

        const userName = item.user?.fullName || item.user?.email || 'Unknown';

        return {
          id: `login-${item.id}`,
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
      ...notifications.map((n) => ({
        id: `notif-${n.id}`,
        sourceId: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
        meta: n.metadata,
      })),
    ];

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const recent = items.slice(0, 30);

    const unreadNotifCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    const unreadActivityCount = sinceDate
      ? activityLogs.filter((l) => new Date(l.createdAt) > sinceDate).length
      : activityLogs.length;

    const loginCount = sinceDate
      ? loginActivities.filter((l) => new Date(l.createdAt) > sinceDate).length
      : loginActivities.length;

    const unreadCount = unreadNotifCount + unreadActivityCount + loginCount;

    res.json({ items: recent, unreadCount });
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      data: {
        isRead: true,
      },
    });

    res.json({
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.json({
      message: 'All notifications marked as read',
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