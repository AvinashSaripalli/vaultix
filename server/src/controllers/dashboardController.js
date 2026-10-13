// controllers/dashboardController.js

const prisma = require('../config/prisma');
const {
  getUserDepartmentIds,
  getDepartmentIdsWithAncestors,
} = require('../utils/permissions');

const OLD_DAYS_THRESHOLD = 180;

const allowedRanges = ['24H', '7D', '30D', '1Y'];

// LOCAL DATE KEY (FIXES IST TIMEZONE ISSUE)
const getLocalDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getAccessibleCompanyScope = async (user) => {
  const vaults = await prisma.vault.findMany({
    where: { type: 'COMPANY' },
    select: { id: true },
  });
  const vaultIds = vaults.map((v) => v.id);

  if (user.role === 'ADMIN') {
    return { vaultIds, folderIds: null, isAdmin: true };
  }

  if (vaultIds.length === 0) {
    return { vaultIds: [], folderIds: [], isAdmin: false };
  }

  const memberOfIds = await getUserDepartmentIds(user.id);
  const departmentIds = await getDepartmentIdsWithAncestors(memberOfIds);

  const candidateFolders = await prisma.folder.findMany({
    where: {
      vaultId: { in: vaultIds },
      OR: [
        { permissions: { some: { userId: user.id } } },
        ...(departmentIds.length
          ? [{ departmentPermissions: { some: { departmentId: { in: departmentIds } } } }]
          : []),
      ],
    },
    select: {
      id: true,
      blockedUserIds: true,
      permissions: { select: { userId: true, accessLevel: true } },
      departmentPermissions: { select: { departmentId: true, accessLevel: true } },
    },
  });

  const DEPT_TO_FOLDER_MAP = {
    NOT_SET: null,
    FORBIDDEN: null,
    READ_ONLY: 'READ_ONLY',
    READ_WRITE: 'READ_WRITE',
    FULL_ACCESS: 'FULL_ACCESS',
    ADMINISTRATOR: 'ADMINISTRATOR',
  };
  const LEVEL_RANK = { READ_ONLY: 0, READ_WRITE: 1, FULL_ACCESS: 2, ADMINISTRATOR: 3 };
  const getHighest = (levels) =>
    levels.reduce((best, lvl) => (!best || (lvl && LEVEL_RANK[lvl] > LEVEL_RANK[best]) ? lvl : best), null);

  const accessibleFolderIds = [];
  for (const f of candidateFolders) {
    const hasDirectNonForbidden = f.permissions.some(
      (p) => p.userId === user.id && p.accessLevel !== 'FORBIDDEN'
    );
    const blocked = Array.isArray(f.blockedUserIds) ? f.blockedUserIds : [];
    const isBlocked = blocked.includes(user.id) && !hasDirectNonForbidden;

    const deptGrants = f.departmentPermissions.filter((g) =>
      departmentIds.includes(g.departmentId)
    );
    const hasDeptForbidden = deptGrants.some((g) => g.accessLevel === 'FORBIDDEN');
    if (hasDeptForbidden) continue;

    const levels = deptGrants.map((g) => DEPT_TO_FOLDER_MAP[g.accessLevel]).filter(Boolean);
    const deptAccess = getHighest(levels);

    const directPerm = f.permissions.find((p) => p.userId === user.id);
    if (directPerm) {
      if (directPerm.accessLevel === 'FORBIDDEN') continue;
      const effective = getHighest([directPerm.accessLevel, deptAccess]);
      if (effective && !isBlocked) accessibleFolderIds.push(f.id);
      continue;
    }

    if (isBlocked) continue;
    if (deptAccess) accessibleFolderIds.push(f.id);
  }

  return { vaultIds, folderIds: accessibleFolderIds, isAdmin: false };
};

const getPasswordWhere = async (user, vaultType, requestedFolderId = null) => {
  const cleanFolderId =
    requestedFolderId && requestedFolderId !== 'ALL' ? String(requestedFolderId) : null;

  if (vaultType === 'COMPANY') {
    const { vaultIds, folderIds, isAdmin } = await getAccessibleCompanyScope(user);
    if (isAdmin) {
      return {
        vaultId: { in: vaultIds },
        ...(cleanFolderId ? { folderId: cleanFolderId } : {}),
        deletedAt: null,
      };
    }
    const allowedIds = folderIds || [];
    const effectiveFolderIds = cleanFolderId
      ? allowedIds.filter((id) => id === cleanFolderId)
      : allowedIds;
    return {
      vaultId: { in: vaultIds },
      folderId: { in: effectiveFolderIds },
      deletedAt: null,
    };
  }

  const vaults = await prisma.vault.findMany({
    where: {
      ownerId: user.id,
      type: 'PERSONAL',
    },
    select: { id: true },
  });

  return {
    vaultId: { in: vaults.map((v) => v.id) },
    ...(cleanFolderId ? { folderId: cleanFolderId } : {}),
    deletedAt: null,
  };
};

const getAccessibleFoldersList = async (user, vaultType) => {
  if (vaultType === 'COMPANY') {
    const { vaultIds, folderIds, isAdmin } = await getAccessibleCompanyScope(user);
    if (!vaultIds.length) return [];
    return prisma.folder.findMany({
      where: {
        vaultId: { in: vaultIds },
        ...(isAdmin ? {} : { id: { in: folderIds || [] } }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  const vaults = await prisma.vault.findMany({
    where: { ownerId: user.id, type: 'PERSONAL' },
    select: { id: true },
  });
  if (!vaults.length) return [];

  return prisma.folder.findMany({
    where: { vaultId: { in: vaults.map((v) => v.id) } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
};

const isEntryOld = (p) => {
  if (p.isOld) return true;
  const d = new Date(p.lastUpdatedAt || p.updatedAt || p.createdAt);
  const ageDays = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
  return ageDays >= OLD_DAYS_THRESHOLD;
};

const calculateSecurityScore = ({
  totalPasswords,
  weakPasswords,
  oldPasswords,
  riskPasswords,
}) => {
  if (totalPasswords === 0) return 100;

  const weakPenalty = (weakPasswords / totalPasswords) * 40;
  const oldPenalty = (oldPasswords / totalPasswords) * 25;
  const riskPenalty = (riskPasswords / totalPasswords) * 35;

  return Math.max(
    0,
    Math.round(100 - weakPenalty - oldPenalty - riskPenalty)
  );
};

// SECURITY SUMMARY
const getSecuritySummary = async (req, res) => {
  try {
    const vaultType =
      req.query.vaultType === 'COMPANY' ? 'COMPANY' : 'PERSONAL';
    const folderId = req.query.folderId || null;

    const [where, folders] = await Promise.all([
      getPasswordWhere(req.user, vaultType, folderId),
      getAccessibleFoldersList(req.user, vaultType),
    ]);

    const passwords = await prisma.passwordEntry.findMany({
      where,
      select: {
        type: true,
        isWeak: true,
        isOld: true,
        isAtRisk: true,
        createdAt: true,
        updatedAt: true,
        lastUpdatedAt: true,
      },
    });

    const totalPasswords = passwords.length;
    const loginPasswords = passwords.filter((p) => !p.type || p.type === 'LOGIN');

    const weakPasswords = loginPasswords.filter((p) => p.isWeak).length;
    const oldPasswords = loginPasswords.filter(isEntryOld).length;
    const riskPasswords = loginPasswords.filter((p) => p.isAtRisk).length;

    const securityScore = calculateSecurityScore({
      totalPasswords: loginPasswords.length,
      weakPasswords,
      oldPasswords,
      riskPasswords,
    });

    const deleteLogs = await prisma.activityLog.findMany({
      where: { action: 'DELETE_PASSWORD' },
      select: { metadata: true },
    });

    const allowedVaultIds = where.vaultId?.in || [];
    const singleFolderId = typeof where.folderId === 'string' ? where.folderId : null;
    const allowedFolderIds = where.folderId?.in || null;

    const deletedPasswords = deleteLogs.filter((log) => {
      const vId = log.metadata?.vaultId;
      const fId = log.metadata?.folderId;
      if (!allowedVaultIds.includes(vId)) return false;
      if (singleFolderId && fId !== singleFolderId) return false;
      if (Array.isArray(allowedFolderIds) && !allowedFolderIds.includes(fId)) {
        return false;
      }
      return true;
    }).length;

    res.json({
      totalPasswords,
      companyPasswords: vaultType === 'COMPANY' ? totalPasswords : 0,
      personalPasswords: vaultType === 'PERSONAL' ? totalPasswords : 0,
      deletedPasswords,
      weakPasswords,
      oldPasswords,
      riskPasswords,
      securityScore,
      folders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PASSWORD ACTIVITY TREND
const getPasswordActivityTrend = async (req, res) => {
  try {
    const range = allowedRanges.includes(req.query.range)
      ? req.query.range
      : '7D';

    const vaultType =
      req.query.vaultType === 'COMPANY' ? 'COMPANY' : 'PERSONAL';
    const folderId = req.query.folderId || null;

    const where = await getPasswordWhere(req.user, vaultType, folderId);
    const allowedVaultIds = where.vaultId?.in || [];
    const singleFolderId = typeof where.folderId === 'string' ? where.folderId : null;
    const allowedFolderIds = where.folderId?.in || null;

    // DATE RANGE
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();

    if (range === '24H') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === '7D') {
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === '30D') {
      startDate.setDate(now.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // 1Y (last 12 months)
      startDate.setMonth(now.getMonth() - 11);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    // FETCH PASSWORDS IN RANGE
    const passwords = await prisma.passwordEntry.findMany({
      where: {
        ...where,
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { updatedAt: { gte: startDate, lte: endDate } },
        ],
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    // FETCH DELETED PASSWORD LOGS
    const deleteLogs = await prisma.activityLog.findMany({
      where: {
        action: 'DELETE_PASSWORD',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        metadata: true,
      },
    });

    const relevantDeletes = deleteLogs.filter((log) => {
      const vId = log.metadata?.vaultId;
      const fId = log.metadata?.folderId;
      if (!allowedVaultIds.includes(vId)) return false;
      if (singleFolderId && fId !== singleFolderId) return false;
      if (Array.isArray(allowedFolderIds) && !allowedFolderIds.includes(fId)) {
        return false;
      }
      return true;
    });

    // CREATE BUCKETS
    const buckets = [];

    const getBucketKey = (date) => {
      const d = new Date(date);
      if (range === '24H') {
        const slot = Math.floor(d.getHours() / 3) * 3;
        return `H-${slot}`;
      }
      if (range === '1Y') {
        return `${d.getFullYear()}-${d.getMonth()}`;
      }
      return getLocalDateKey(d);
    };

    if (range === '24H') {
      const labels = ['12 AM', '3 AM', '6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'];
      for (let i = 0; i < 8; i++) {
        buckets.push({
          key: `H-${i * 3}`,
          label: labels[i],
          added: 0,
          updated: 0,
          deleted: 0,
        });
      }
    } else if (range === '1Y') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label: d.toLocaleString('en-US', { month: 'short' }),
          added: 0,
          updated: 0,
          deleted: 0,
        });
      }
    } else {
      const current = new Date(startDate);
      while (current <= endDate) {
        buckets.push({
          key: getLocalDateKey(current),
          label: current.toLocaleString('en-US', {
            day: '2-digit',
            month: 'short',
          }),
          added: 0,
          updated: 0,
          deleted: 0,
        });
        current.setDate(current.getDate() + 1);
      }
    }

    // MAP PASSWORDS (ADDED & UPDATED)
    passwords.forEach((password) => {
      const cDate = new Date(password.createdAt);
      if (cDate >= startDate && cDate <= endDate) {
        const key = getBucketKey(cDate);
        const found = buckets.find((b) => b.key === key);
        if (found) found.added += 1;
      }

      const uDate = new Date(password.updatedAt);
      // Count as updated if updatedAt is at least 10 seconds after createdAt
      if (
        uDate >= startDate &&
        uDate <= endDate &&
        uDate.getTime() - cDate.getTime() > 10000
      ) {
        const key = getBucketKey(uDate);
        const found = buckets.find((b) => b.key === key);
        if (found) found.updated += 1;
      }
    });

    // MAP DELETES
    relevantDeletes.forEach((log) => {
      const key = getBucketKey(log.createdAt);
      const found = buckets.find((b) => b.key === key);
      if (found) found.deleted += 1;
    });

    res.json({
      passwordTrend: buckets.map((b) => ({
        label: b.label,
        added: b.added,
        updated: b.updated,
        deleted: b.deleted,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// RECENT PASSWORDS
const getRecentPasswords = async (req, res) => {
  try {
    const vaultType =
      req.query.vaultType === 'COMPANY' ? 'COMPANY' : 'PERSONAL';
    const folderId = req.query.folderId || null;

    const where = await getPasswordWhere(req.user, vaultType, folderId);

    const recentPasswordsRaw = await prisma.passwordEntry.findMany({
      where,
      include: {
        vault: {
          select: { id: true, name: true, type: true },
        },
        folder: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 30,
    });

    const recentPasswords = recentPasswordsRaw.map((p) => ({
      ...p,
      isOld: (!p.type || p.type === 'LOGIN') ? isEntryOld(p) : false,
    }));

    res.json({
      recentPasswords,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSecuritySummary,
  getPasswordActivityTrend,
  getRecentPasswords,
};