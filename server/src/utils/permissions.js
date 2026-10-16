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

const getDepartmentVaultAccess = async (vaultId, userId) => {
  const memberOfIds = await getUserDepartmentIds(userId);

  if (!memberOfIds.length) return null;

  const departmentIds = await getDepartmentIdsWithAncestors(memberOfIds);

  const grants = await prisma.departmentPermission.findMany({
    where: {
      vaultId,
      departmentId: { in: departmentIds },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!grants.length) return null;

  // FORBIDDEN is an explicit deny
  const hasForbidden = grants.some((g) => g.accessLevel === 'FORBIDDEN');
  if (hasForbidden) return 'FORBIDDEN';

  // VaultAccessLevel shares same rank as LEVEL_RANK
  const levels = grants.map((g) => g.accessLevel).filter((l) => l !== 'FORBIDDEN' && l !== 'NOT_SET');
  return getHighestVaultLevel(levels);
};

const getDepartmentFolderAccess = async (folderId, userId) => {
  const memberOfIds = await getUserDepartmentIds(userId);

  if (!memberOfIds.length) return null;

  const departmentIds = await getDepartmentIdsWithAncestors(memberOfIds);

  const grants = await prisma.departmentPermission.findMany({
    where: {
      folderId,
      departmentId: { in: departmentIds },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!grants.length) return null;

  // FORBIDDEN is an explicit deny — wins over any other grant
  const hasForbidden = grants.some((g) => g.accessLevel === 'FORBIDDEN');
  if (hasForbidden) return 'FORBIDDEN';

  // Among remaining grants, pick the highest level
  const levels = grants.map((g) => DEPT_TO_FOLDER_MAP[g.accessLevel]).filter(Boolean);
  return getHighestFolderLevel(levels);
};

const getFolderAccess = async (folderId, userId) => {
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

  // Check department access — FORBIDDEN is an explicit deny
  const departmentAccess = await getDepartmentFolderAccess(folder.id, userId);
  if (departmentAccess === 'FORBIDDEN') return null;

  const permission = folder.permissions.find((item) => item.userId === userId);

  if (permission) {
    // FORBIDDEN direct permission is an explicit deny — wins over department access
    if (permission.accessLevel === 'FORBIDDEN') return null;
    return getHighestFolderLevel([permission.accessLevel, departmentAccess]);
  }

  // Blocked users are explicitly removed from this folder — no department
  // access can restore them (unless a direct permission is added later).
  const blocked = Array.isArray(folder.blockedUserIds) ? folder.blockedUserIds : [];
  if (blocked.includes(userId)) return null;

  return departmentAccess;
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

  // Check department access — FORBIDDEN is an explicit deny
  const departmentAccess = await getDepartmentVaultAccess(vault.id, userId);
  if (departmentAccess === 'FORBIDDEN') return null;

  const permission = vault.permissions.find((item) => item.userId === userId);

  return getHighestVaultLevel([permission?.accessLevel, departmentAccess]);
};

const getFolderAuthorizedUserIds = async (folderId) => {
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

    const blocked = new Set(
      Array.isArray(folder.blockedUserIds) ? folder.blockedUserIds : []
    );
    const userIds = new Set([folder.vault.ownerId]);

    for (const blockedId of blocked) {
      userIds.delete(blockedId);
    }

    for (const perm of folder.permissions) {
      if (perm.userId && perm.accessLevel !== 'FORBIDDEN') userIds.add(perm.userId);
    }

    const [admins, grants] = await Promise.all([
      prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } }, select: { id: true } }),
      prisma.departmentPermission.findMany({
        where: { folderId },
        select: { departmentId: true },
      }),
    ]);

    for (const admin of admins) {
      userIds.add(admin.id);
    }

    if (grants.length > 0) {
      const [allDepartments, memberships] = await Promise.all([
        prisma.department.findMany({ select: { id: true, parentId: true } }),
        prisma.departmentMember.findMany({
          select: { departmentId: true, userId: true },
        }),
      ]);

      const childrenMap = new Map();
      for (const dept of allDepartments) {
        if (!childrenMap.has(dept.parentId)) childrenMap.set(dept.parentId, []);
        childrenMap.get(dept.parentId).push(dept.id);
      }

      const expanded = new Set();
      const stack = grants.map((grant) => grant.departmentId);

      while (stack.length > 0) {
        const current = stack.pop();
        if (expanded.has(current)) continue;
        expanded.add(current);
        for (const child of childrenMap.get(current) || []) stack.push(child);
      }

      for (const member of memberships) {
        if (member.userId && expanded.has(member.departmentId)) {
          if (!blocked.has(member.userId)) userIds.add(member.userId);
        }
      }
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

const getFolderDepartmentMembers = async (folderId) => {
  try {
    const [grants, folder, allDepts, allMemberships] = await Promise.all([
      prisma.departmentPermission.findMany({
        where: { folderId },
        include: {
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.folder.findUnique({
        where: { id: folderId },
        select: { blockedUserIds: true, permissions: { select: { userId: true, accessLevel: true } } },
      }),
      prisma.department.findMany({ select: { id: true, parentId: true } }),
      prisma.departmentMember.findMany({
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
    ]);

    if (!grants.length) return [];

    const blocked = new Set(
      Array.isArray(folder?.blockedUserIds) ? folder.blockedUserIds : []
    );
    const forbidden = new Set(
      (folder?.permissions || [])
        .filter((p) => p.accessLevel === 'FORBIDDEN')
        .map((p) => p.userId)
    );

    // Build children map to expand grants to descendant sub-departments (access flows down)
    const childrenMap = new Map();
    for (const d of allDepts) {
      if (!childrenMap.has(d.parentId)) childrenMap.set(d.parentId, []);
      childrenMap.get(d.parentId).push(d.id);
    }

    const membershipsByDept = new Map();
    for (const m of allMemberships) {
      if (!membershipsByDept.has(m.departmentId)) membershipsByDept.set(m.departmentId, []);
      membershipsByDept.get(m.departmentId).push(m);
    }

    const membersByUser = new Map();

    for (const grant of grants) {
      const folderAccess = DEPT_TO_FOLDER_MAP[grant.accessLevel];
      if (!folderAccess) continue;

      // Expand grant department to include all descendants
      const expanded = new Set([grant.department.id]);
      const stack = [grant.department.id];
      while (stack.length) {
        const cur = stack.pop();
        for (const child of childrenMap.get(cur) || []) {
          if (!expanded.has(child)) {
            expanded.add(child);
            stack.push(child);
          }
        }
      }

      for (const deptId of expanded) {
        const deptMembers = membershipsByDept.get(deptId) || [];
        for (const member of deptMembers) {
          if (!member.user) continue;
          const uid = member.user.id;
          if (blocked.has(uid) || forbidden.has(uid)) continue;
          const existing = membersByUser.get(uid);
          if (!existing || LEVEL_RANK[folderAccess] > LEVEL_RANK[existing.accessLevel]) {
            membersByUser.set(uid, {
              user: member.user,
              accessLevel: folderAccess,
              departmentName: grant.department.name,
              departmentId: grant.department.id,
              viaDepartment: true,
            });
          }
        }
      }
    }

    return [...membersByUser.values()];
  } catch (error) {
    console.error('Get folder department members error:', error);
    return [];
  }
};

module.exports = {
  isAdminUser,
  getUserDepartmentIds,
  getDepartmentIdsWithAncestors,
  getVaultAccess,
  getFolderAccess,
  getFolderAuthorizedUserIds,
  getFolderDepartmentMembers,
  requireFolderAccess,
  DEPT_TO_FOLDER_MAP,
};