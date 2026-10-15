const prisma = require('../config/prisma');

const { getVaultAccess } = require('../utils/permissions');

const getAllActivityLogs = async (req, res) => {
  try {
    const isAdmin = ['OWNER', 'ADMIN'].includes(req.user.role);
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
      ? logs.filter((log) => !(log.metadata?.personalVault && log.userId !== req.user.id))
      : logs;

    res.json(filtered);
  } catch (error) {
    console.error('Get all activity logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getVaultActivityLogs = async (req, res) => {
  try {
    const vaultId = req.params.vaultId;

    const access = await getVaultAccess(vaultId, req.user.id);

    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const logs = await prisma.activityLog.findMany({
      where: {
        OR: [
          {
            metadata: {
              path: ['vaultId'],
              equals: vaultId,
            },
          },
          {
            targetId: vaultId,
          },
        ],
      },
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
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const access = await getVaultAccess(vaultId, req.user.id);
    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const logs = await prisma.activityLog.findMany({
      where: {
        OR: [
          { metadata: { path: ['vaultId'], equals: vaultId } },
          { targetId: vaultId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    // Non-owners/admins: exclude other users' personal-vault noise and only
    // surface activity that pertains to this vault.
    const filtered = ['OWNER', 'ADMIN'].includes(req.user.role) || access === 'ADMINISTRATOR'
      ? logs
      : logs.filter((log) => log.userId === req.user.id || log.metadata?.vaultId === vaultId);

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
        `attachment; filename="vault-audit-${vaultId}.csv"`
      );
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vault-audit-${vaultId}.json"`
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