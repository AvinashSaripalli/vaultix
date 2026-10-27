const prisma = require('../config/prisma');

const LEVEL_RANK = {
  READ_ONLY: 0,
  READ_WRITE: 1,
  FULL_ACCESS: 2,
  ADMINISTRATOR: 3,
};

const VAULT_LEVEL_RANK = LEVEL_RANK;
const FOLDER_LEVEL_RANK = LEVEL_RANK;

const DEPT_TO_FOLDER_MAP = {
  NOT_SET: null,
  FORBIDDEN: null,
  READ_ONLY: 'READ_ONLY',
  READ_WRITE: 'READ_WRITE',
  FULL_ACCESS: 'FULL_ACCESS',
  ADMINISTRATOR: 'ADMINISTRATOR',
};

const isAdminUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
};

const getUserDepartmentIds = async (userId) => {
  const memberships = await prisma.departmentMember.findMany({
    where: { userId },
    select: { departmentId: true },
  });

  return memberships.map((membership) => membership.departmentId);
};

const getDepartmentIdsWithAncestors = async (departmentIds) => {
  if (!departmentIds.length) return [];

  const allDepartments = await prisma.department.findMany({
    select: { id: true, parentId: true },
  });

  const parentMap = new Map(allDepartments.map((d) => [d.id, d.parentId]));
  const result = new Set();

  for (const startId of departmentIds) {
    let currentId = startId;
    const guard = new Set();

    while (currentId && !guard.has(currentId)) {
      guard.add(currentId);
      result.add(currentId);
      currentId = parentMap.get(currentId) || null;
    }
  }

  return [...result];
};

const getHighestVaultLevel = (levels) =>
  levels.reduce(
    (best, level) =>
      level && (!best || VAULT_LEVEL_RANK[level] > VAULT_LEVEL_RANK[best]) ? level : best,
    null
  );

const getHighestFolderLevel = (levels) =>
  levels.reduce(
    (best, level) =>
      level && (!best || FOLDER_LEVEL_RANK[level] > FOLDER_LEVEL_RANK[best]) ? level : best,
    null
  );

const getDepartmentVaultAccess = async () => null;

const getDepartmentFolderAccess = async () => null;

const getFolderAccess = async (folderId, userId) => {
  if (!folderId) return null;

  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: {
      permissions: true,
      vault: true,
    },
  });

  if (!folder) return null;

  if (folder.vault.type === 'PERSONAL') {
    return folder.vault.ownerId === userId ? 'ADMINISTRATOR' : null;
  }

  const admin = await isAdminUser(userId);
  if (admin) return 'ADMINISTRATOR';

  if (folder.vault.ownerId === userId) {
    return 'ADMINISTRATOR';
  }

  const permission = folder.permissions.find((item) => item.userId === userId);

  if (permission) {
    if (permission.accessLevel === 'FORBIDDEN') return null;
    return permission.accessLevel;
  }

  return null;
};

const getVaultAccess = async (vaultId, userId) => {
  const vault = await prisma.vault.findUnique({
    where: { id: vaultId },
    include: {
      permissions: true,
    },
  });

  if (!vault) return null;

  if (vault.type === 'PERSONAL') {
    return vault.ownerId === userId ? 'ADMINISTRATOR' : null;
  }

  const admin = await isAdminUser(userId);
  if (admin) return 'ADMINISTRATOR';

  if (vault.ownerId === userId) {
    return 'ADMINISTRATOR';
  }

  const permission = vault.permissions.find((item) => item.userId === userId);

  return permission && permission.accessLevel !== 'FORBIDDEN' ? permission.accessLevel : null;
};

const getFolderAuthorizedUserIds = async (folderId) => {
  if (!folderId) return [];
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: {
        vault: { select: { type: true, ownerId: true } },
        permissions: { select: { userId: true, accessLevel: true } },
        blockedUserIds: true,
      },
    });

    if (!folder) return [];

    if (folder.vault.type === 'PERSONAL') {
      return [folder.vault.ownerId];
    }

    const userIds = new Set([folder.vault.ownerId]);

    for (const perm of folder.permissions) {
      if (perm.userId && perm.accessLevel !== 'FORBIDDEN') userIds.add(perm.userId);
    }

    const admins = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
      select: { id: true },
    });

    for (const admin of admins) {
      userIds.add(admin.id);
    }

    return [...userIds];
  } catch (error) {
    console.error('Get folder authorized user ids error:', error);
    return [];
  }
};

const requireFolderAccess = (allowedLevels = []) => {
  return async (req, res, next) => {
    try {
      const body = req.body || {};

      let folderId =
        req.params?.folderId ||
        req.params?.id ||
        body.folderId ||
        body.id ||
        req.passwordEntry?.folderId;

      if (!folderId && req.params?.id) {
        const password = await prisma.passwordEntry.findUnique({
          where: { id: req.params.id },
          select: { folderId: true },
        });

        if (password) {
          folderId = password.folderId;
        }
      }

      if (!folderId) {
        return res.status(400).json({ message: 'Folder id is required' });
      }

      const access = await getFolderAccess(folderId, req.user.id);

      if (!access || !allowedLevels.includes(access)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      req.folderAccess = access;
      req.folderId = folderId;

      next();
    } catch (error) {
      console.error('Folder permission error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

const getFolderDepartmentMembers = async () => {
  return [];
};

const getPasswordItemAccess = async (password, userId) => {
  if (!password) return null;

  if (password.folderId) {
    const folderAccess = await getFolderAccess(password.folderId, userId);
    if (folderAccess) return folderAccess;
  }

  if (password.vaultId) {
    return await getVaultAccess(password.vaultId, userId);
  }

  return null;
};

const getVaultType = async (vaultId) => {
  try {
    if (!vaultId) return null;
    const vault = await prisma.vault.findUnique({
      where: { id: vaultId },
      select: { type: true },
    });
    return vault?.type || null;
  } catch {
    return null;
  }
};

module.exports = {
  isAdminUser,
  getUserDepartmentIds,
  getDepartmentIdsWithAncestors,
  getVaultAccess,
  getVaultType,
  getFolderAccess,
  getPasswordItemAccess,
  getFolderAuthorizedUserIds,
  getFolderDepartmentMembers,
  requireFolderAccess,
  DEPT_TO_FOLDER_MAP,
};