const prisma = require('../config/prisma');

const { getVaultAccess, getFolderAccess } = require('../utils/permissions');

const getAllActivityLogs = async (req, res) => {
  try {
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const { departmentId } = req.query;

    let whereClause = isAdmin ? {} : { userId: req.user.id };

    if (departmentId && isAdmin) {
      const memberIds = (
        await prisma.departmentMember.findMany({
          where: { departmentId },
          select: { userId: true },
        })
      ).map((m) => m.userId);

      whereClause = { userId: { in: memberIds } };
    }

    const logs = await prisma.activityLog.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const filtered = isAdmin
      ? logs.filter(
          (log) =>
            !(
              (log.metadata?.personalVault || log.metadata?.vaultType === 'PERSONAL') &&
              log.userId !== req.user.id
            )
        )
      : logs;

    const passwordTargetIds = [
      ...new Set(
        filtered
          .filter(
            (l) => l.targetType === 'PasswordEntry' || (l.targetId && l.targetId.startsWith('PWD-'))
          )
          .map((l) => l.targetId)
          .filter(Boolean)
      ),
    ];

    if (passwordTargetIds.length > 0) {
      const items = await prisma.passwordEntry.findMany({
        where: { id: { in: passwordTargetIds } },
        select: { id: true, type: true, name: true },
      });
      const itemMap = new Map(items.map((i) => [i.id, i]));
      for (const log of filtered) {
        if (log.targetId && itemMap.has(log.targetId)) {
          const item = itemMap.get(log.targetId);
          const meta = log.metadata || {};
          const currentName = item.name;
          const historicalName = meta.name;
          const wasRenamed = Boolean(historicalName && currentName && historicalName !== currentName);

          log.metadata = {
            ...meta,
            itemType: meta.itemType || item.type,
            currentName,
            ...(wasRenamed
              ? {
                  wasRenamed: true,
                  historicalName,
                }
              : {}),
          };
        }
      }
    }

    res.json(filtered);
  } catch (error) {
    console.error('Get all activity logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getVaultActivityLogs = async (req, res) => {
  try {
    const vaultId = req.params.vaultId;
    const folderId = req.query.folderId;

    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const access = await getVaultAccess(vaultId, req.user.id);

    let authorized = isAdmin || !!access;
    let allowedFolderIds = [];

    if (!authorized) {
      if (folderId) {
        const folderAccess = await getFolderAccess(folderId, req.user.id);
        if (folderAccess && folderAccess !== 'FORBIDDEN') {
          authorized = true;
          allowedFolderIds = [folderId];
        }
      } else {
        const userFolders = await prisma.folder.findMany({
          where: { vaultId, deletedAt: null },
          select: { id: true },
        });
        for (const f of userFolders) {
          const fAccess = await getFolderAccess(f.id, req.user.id);
          if (fAccess && fAccess !== 'FORBIDDEN') {
            allowedFolderIds.push(f.id);
          }
        }
        if (allowedFolderIds.length > 0) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let whereCondition;
    if (folderId) {
      whereCondition = {
        OR: [
          { metadata: { path: ['folderId'], equals: folderId } },
          { targetId: folderId },
        ],
      };
    } else if (allowedFolderIds.length > 0 && !isAdmin && !access) {
      whereCondition = {
        OR: [
          { targetId: { in: allowedFolderIds } },
          ...allowedFolderIds.map((id) => ({
            metadata: { path: ['folderId'], equals: id },
          })),
        ],
      };
    } else {
      whereCondition = {
        OR: [
          { metadata: { path: ['vaultId'], equals: vaultId } },
          { targetId: vaultId },
        ],
      };
    }

    const logs = await prisma.activityLog.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    res.json(logs);
  } catch (error) {
    console.error('Get vault activity logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const exportVaultAudit = async (req, res) => {
  try {
    const vaultId = req.params.vaultId;
    const folderId = req.query.folderId;
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const access = await getVaultAccess(vaultId, req.user.id);

    let authorized = isAdmin || (access && ['ADMINISTRATOR', 'FULL_ACCESS'].includes(access));
    let allowedFolderIds = [];

    if (!authorized) {
      if (folderId) {
        const folderAccess = await getFolderAccess(folderId, req.user.id);
        if (folderAccess && ['ADMINISTRATOR', 'FULL_ACCESS'].includes(folderAccess)) {
          authorized = true;
          allowedFolderIds = [folderId];
        }
      } else {
        const userFolders = await prisma.folder.findMany({
          where: { vaultId, deletedAt: null },
          select: { id: true },
        });
        for (const f of userFolders) {
          const fAccess = await getFolderAccess(f.id, req.user.id);
          if (fAccess && ['ADMINISTRATOR', 'FULL_ACCESS'].includes(fAccess)) {
            allowedFolderIds.push(f.id);
          }
        }
        if (allowedFolderIds.length > 0) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({ message: 'Access denied. Administrator or Full Access required.' });
    }

    let whereCondition;
    if (folderId) {
      whereCondition = {
        OR: [
          { metadata: { path: ['folderId'], equals: folderId } },
          { targetId: folderId },
        ],
      };
    } else if (allowedFolderIds.length > 0 && !isAdmin && (!access || !['ADMINISTRATOR', 'FULL_ACCESS'].includes(access))) {
      whereCondition = {
        OR: [
          { targetId: { in: allowedFolderIds } },
          ...allowedFolderIds.map((id) => ({
            metadata: { path: ['folderId'], equals: id },
          })),
        ],
      };
    } else {
      whereCondition = {
        OR: [
          { metadata: { path: ['vaultId'], equals: vaultId } },
          { targetId: vaultId },
        ],
      };
    }

    const logs = await prisma.activityLog.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    // Non-admins without vault-level admin: exclude other users' personal-vault noise
    const filtered = isAdmin || access === 'ADMINISTRATOR'
      ? logs
      : logs.filter((log) => log.userId === req.user.id || log.metadata?.vaultId === vaultId || log.metadata?.folderId);

    const rows = filtered.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      user: log.user?.email || '',
      userName: log.user?.fullName || '',
      action: log.action,
      targetType: log.targetType || '',
      targetId: log.targetId || '',
      metadata: log.metadata ? JSON.stringify(log.metadata) : '',
    }));

    const filenamePrefix = folderId ? `folder-audit-${folderId}` : `vault-audit-${vaultId}`;

    if (format === 'csv') {
      const header = 'id,timestamp,user,userName,action,targetType,targetId,metadata\n';
      const escape = (v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = rows.map((r) =>
        [r.id, r.timestamp, r.user, r.userName, r.action, r.targetType, r.targetId, r.metadata]
          .map(escape)
          .join(',')
      );
      const csv = header + lines.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filenamePrefix}.csv"`
      );
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filenamePrefix}.json"`
    );
    res.json(rows);
  } catch (error) {
    console.error('Export vault audit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllActivityLogs,
  getVaultActivityLogs,
  exportVaultAudit,
};