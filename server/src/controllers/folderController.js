const prisma = require('../config/prisma');
const {
  isAdminUser,
  getFolderAccess,
  getFolderAuthorizedUserIds,
  getFolderDepartmentMembers,
  getUserDepartmentIds,
  getDepartmentIdsWithAncestors,
  getVaultType,
  getVaultAccess,
} = require('../utils/permissions');
const { getEffectiveOrganizationPolicy } = require('../utils/organizationPolicy');
const generateId = require('../utils/generateId');

const ALLOWED_ACCESS_LEVELS = [
  'READ_ONLY',
  'READ_WRITE',
  'FULL_ACCESS',
  'ADMINISTRATOR',
  'FORBIDDEN',
];

const createFolder = async (req, res) => {
  try {
    const admin = await isAdminUser(req.user.id);

    if (!admin) {
      return res.status(403).json({
        message: 'Only administrator can create folders',
      });
    }

    const { name, vaultId, parentId, wrappedKeys } = req.body;

    if (!name || !vaultId) {
      return res.status(400).json({ message: 'Name and vaultId are required' });
    }

    if (parentId) {
      return res.status(400).json({ message: 'Subfolders are not allowed' });
    }

    const folderId = await generateId('folder');
    const activityId = await generateId('activityLog');

    const folder = await prisma.$transaction(async (tx) => {
      const createdFolder = await tx.folder.create({
        data: {
          id: folderId,
          name,
          vaultId,
          parentId: null,
          wrappedKeys: wrappedKeys || null,
        },
        include: {
          permissions: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true },
              },
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          id: activityId,
          userId: req.user.id,
          action: 'CREATE_FOLDER',
          targetType: 'Folder',
          targetId: createdFolder.id,
          metadata: {
            name: createdFolder.name,
            vaultId,
            folderId: createdFolder.id,
          },
        },
      });

      return createdFolder;
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const shareFolder = async (req, res) => {
  try {
    const folderId = req.params.id;
    const { userEmail, accessLevel } = req.body;

    if (!folderId) {
      return res.status(400).json({ message: 'Folder id is required' });
    }

    if (!userEmail || !accessLevel) {
      return res.status(400).json({ message: 'userEmail and accessLevel are required' });
    }

    if (!ALLOWED_ACCESS_LEVELS.includes(accessLevel)) {
      return res.status(400).json({ message: 'Invalid access level' });
    }

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const access = await getFolderAccess(folderId, req.user.id);
    if (!access || access !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const folderPermissionId = await generateId('folderPermission');

    const permission = await prisma.folderPermission.upsert({
      where: {
        folderId_userId: {
          folderId,
          userId: user.id,
        },
      },
      update: {
        accessLevel,
      },
      create: {
        id: folderPermissionId,
        folderId,
        userId: user.id,
        accessLevel,
      },
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

    const activityId = await generateId('activityLog');

    await prisma.activityLog.create({
      data: {
        id: activityId,
        userId: req.user.id,
        action: 'SHARE_FOLDER',
        targetType: 'Folder',
        targetId: folderId,
        metadata: {
          folderId,
          sharedWith: user.email,
          accessLevel,
        },
      },
    });

    res.json(permission);
  } catch (error) {
    console.error('Share folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (parentId) {
      return res.status(400).json({ message: 'Subfolders are not allowed' });
    }

    const existingFolder = await prisma.folder.findUnique({
      where: { id: req.params.id },
    });

    if (!existingFolder || existingFolder.deletedAt) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const access = await getFolderAccess(existingFolder.id, req.user.id);
    if (!access || access !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedFolder = await prisma.folder.update({
      where: { id: req.params.id },
      data: {
        name,
        parentId: null,
      },
      include: {
        permissions: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'UPDATE_FOLDER',
        targetType: 'Folder',
        targetId: updatedFolder.id,
        metadata: {
          name: updatedFolder.name,
          folderId: updatedFolder.id,
          vaultId: updatedFolder.vaultId,
        },
      },
    });

    res.json(updatedFolder);
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getFoldersByVault = async (req, res) => {
  try {
    const vaultId = req.params.vaultId;

    // Self-healing: If any folder was in trash but contains active passwords (deletedAt === null),
    // automatically restore the folder so it is not hidden from the sidebar and views.
    await prisma.folder.updateMany({
      where: {
        vaultId,
        deletedAt: { not: null },
        passwords: {
          some: {
            deletedAt: null,
          },
        },
      },
      data: {
        deletedAt: null,
      },
    });

    const admin = await isAdminUser(req.user.id);

    let folders;

    if (admin) {
      folders = await prisma.folder.findMany({
        where: {
          vaultId: req.params.vaultId,
          deletedAt: null,
        },
        include: {
          vault: {
            include: {
              owner: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          permissions: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    } else {
      const memberOfIds = await getUserDepartmentIds(req.user.id);
      const departmentIds = await getDepartmentIdsWithAncestors(memberOfIds);

      let candidateFolders = await prisma.folder.findMany({
        where: {
          vaultId: req.params.vaultId,
          deletedAt: null,
          OR: [
            {
              permissions: {
                some: {
                  userId: req.user.id,
                  accessLevel: { not: 'FORBIDDEN' },
                },
              },
            },
            ...(departmentIds.length
              ? [
                  {
                    departmentPermissions: {
                      some: {
                        departmentId: { in: departmentIds },
                        accessLevel: { notIn: ['FORBIDDEN', 'NOT_SET'] },
                      },
                    },
                  },
                ]
              : []),
          ],
        },
        include: {
          vault: {
            include: {
              owner: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          permissions: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Apply blocked filtering (blocked users lose department-derived access)
      if (candidateFolders.length) {
        const fetchedBlocked = await prisma.folder.findMany({
          where: { id: { in: candidateFolders.map((f) => f.id) } },
          select: { id: true, blockedUserIds: true, permissions: { select: { userId: true, accessLevel: true } } },
        });
        const blockedMap = new Map(fetchedBlocked.map((f) => [f.id, f]));
        folders = candidateFolders.filter((f) => {
          const meta = blockedMap.get(f.id);
          const blocked = Array.isArray(meta?.blockedUserIds) ? meta.blockedUserIds : [];
          if (!blocked.includes(req.user.id)) return true;
          const hasDirect = (meta?.permissions || []).some((p) => p.userId === req.user.id && p.accessLevel !== 'FORBIDDEN');
          return hasDirect;
        });
      } else {
        folders = [];
      }
    }

    const userId = req.user.id;
    // Fetch wrappedKeys + blocked for myWrappedKey extraction without extra query per folder if possible
    const wrappedMap = new Map();
    if (folders.length) {
      const withKeys = await prisma.folder.findMany({
        where: { id: { in: folders.map((f) => f.id) } },
        select: { id: true, wrappedKeys: true },
      });
      for (const f of withKeys) wrappedMap.set(f.id, f.wrappedKeys);
    }
    const result = await Promise.all(
      folders.map(async (folder) => {
        const allWrappedKeys = wrappedMap.get(folder.id) || folder.wrappedKeys || {};
        const myWrappedKey = allWrappedKeys[req.user.id] || null;
        const { wrappedKeys, ...rest } = folder;
        const departmentMembers = await getFolderDepartmentMembers(folder.id);
        return { ...rest, myWrappedKey, departmentMembers };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Get folders by vault error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getFolderById = async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: {
        vault: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        permissions: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        passwords: {
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
      },
    });

    if (!folder || folder.deletedAt) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const access = await getFolderAccess(folder.id, req.user.id);

    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const allWrappedKeys = folder.wrappedKeys || {};
    const myWrappedKey = allWrappedKeys[req.user.id] || null;
    const { wrappedKeys, ...folderData } = folder;

    const departmentMembers = await getFolderDepartmentMembers(folder.id);

    res.json({ ...folderData, myWrappedKey, departmentMembers });
  } catch (error) {
    console.error('Get folder by id error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getFolderActivityLogs = async (req, res) => {
  try {
    const folderId = req.params.id;

    const access = await getFolderAccess(folderId, req.user.id);
    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filteredLogs = await prisma.activityLog.findMany({
      where: {
        OR: [
          { targetId: folderId },
          { metadata: { path: ['folderId'], equals: folderId } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(filteredLogs);
  } catch (error) {
    console.error('Get folder activity logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// UPDATE permission (change access level)
const updateFolderPermission = async (req, res) => {
  try {
    const { accessLevel } = req.body;
    const { id } = req.params;

    if (!accessLevel) {
      return res.status(400).json({ message: 'Access level is required' });
    }

    if (!ALLOWED_ACCESS_LEVELS.includes(accessLevel)) {
      return res.status(400).json({ message: `Invalid access level. Must be one of: ${ALLOWED_ACCESS_LEVELS.join(', ')}` });
    }

    const existing = await prisma.folderPermission.findUnique({
      where: { id },
      select: { folderId: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    const adminAccess = await getFolderAccess(existing.folderId, req.user.id);
    if (!adminAccess || adminAccess !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const permission = await prisma.folderPermission.update({
      where: { id },
      data: { accessLevel },
    });

    res.json(permission);
  } catch (error) {
    console.error('Update folder permission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// DELETE permission (remove user from folder)
const deleteFolderPermission = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.folderPermission.findUnique({
      where: { id },
      select: { folderId: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    const adminAccess = await getFolderAccess(existing.folderId, req.user.id);
    if (!adminAccess || adminAccess !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prisma.folderPermission.delete({
      where: { id },
    });

    res.json({ message: 'User removed from folder' });
  } catch (error) {
    console.error('Delete folder permission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// BLOCK user from folder (removes a department-derived member)
const blockFolderUser = async (req, res) => {
  try {
    const folderId = req.params.id;
    const { userId } = req.body;

    if (!folderId) {
      return res.status(400).json({ message: 'Folder id is required' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const adminAccess = await getFolderAccess(folderId, req.user.id);
    if (!adminAccess || adminAccess !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { blockedUserIds: true, vault: { select: { ownerId: true } } },
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (folder.vault.ownerId === userId) {
      return res.status(400).json({ message: 'The Super Admin cannot be removed from the folder' });
    }

    const currentBlocked = Array.isArray(folder.blockedUserIds)
      ? folder.blockedUserIds
      : [];

    const blockedUserIds = currentBlocked.includes(userId)
      ? currentBlocked
      : [...currentBlocked, userId];

    await prisma.$transaction([
      prisma.folderPermission.deleteMany({
        where: { folderId, userId },
      }),
      prisma.folder.update({
        where: { id: folderId },
        data: { blockedUserIds },
      }),
      prisma.activityLog.create({
        data: {
          id: await generateId('activityLog'),
          userId: req.user.id,
          action: 'UPDATE_FOLDER',
          targetType: 'Folder',
          targetId: folderId,
          metadata: { folderId, userId },
        },
      }),
    ]);

    res.json({ message: 'User removed from folder' });
  } catch (error) {
    console.error('Block folder user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteFolder = async (req, res) => {
  try {
    const folderId = req.params.id;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (folder.deletedAt) {
      return res.status(400).json({ message: 'Folder is already in trash' });
    }

    const access = await getFolderAccess(folderId, req.user.id);
    if (!access || access !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Soft-delete the folder
      await tx.folder.update({
        where: { id: folderId },
        data: { deletedAt: now },
      });

      // 2. Soft-delete all active passwords in this folder
      await tx.passwordEntry.updateMany({
        where: {
          folderId,
          deletedAt: null,
        },
        data: { deletedAt: now },
      });

      await tx.activityLog.create({
        data: {
          id: await generateId('activityLog'),
          userId: req.user.id,
          action: 'DELETE_FOLDER',
          targetType: 'Folder',
          targetId: folderId,
          metadata: {
            name: folder.name,
            vaultId: folder.vaultId,
            folderId: folder.id,
            softDelete: true,
          },
        },
      });
    });

    res.json({ message: 'Folder and its passwords moved to trash' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const restoreFolder = async (req, res) => {
  try {
    const folderId = req.params.id;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (!folder.deletedAt) {
      return res.status(400).json({ message: 'Folder is not in trash' });
    }

    const access = await getFolderAccess(folderId, req.user.id);
    if (!access || access !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Restore the folder
      await tx.folder.update({
        where: { id: folderId },
        data: { deletedAt: null },
      });

      // 2. Restore all passwords in this folder that were in trash
      await tx.passwordEntry.updateMany({
        where: {
          folderId,
          deletedAt: { not: null },
        },
        data: { deletedAt: null },
      });

      await tx.activityLog.create({
        data: {
          id: await generateId('activityLog'),
          userId: req.user.id,
          action: 'UPDATE_FOLDER',
          targetType: 'Folder',
          targetId: folderId,
          metadata: {
            name: folder.name,
            vaultId: folder.vaultId,
            folderId: folder.id,
            restored: true,
          },
        },
      });
    });

    res.json({ message: 'Folder and passwords restored successfully' });
  } catch (error) {
    console.error('Restore folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const purgeFolder = async (req, res) => {
  try {
    const folderId = req.params.id;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: { vault: true },
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (!folder.deletedAt) {
      return res.status(400).json({ message: 'Folder is not in trash' });
    }

    const access = await getFolderAccess(folderId, req.user.id);
    if (!access || access !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const vaultType = await getVaultType(folder.vaultId);
    const policy = await getEffectiveOrganizationPolicy();

    if (vaultType !== 'PERSONAL' && req.user.role === 'ADMIN' && policy?.requireDualAdminApproval) {
      const approvalId = await generateId('req');
      const approvalRequest = await prisma.adminApprovalRequest.create({
        data: {
          id: approvalId,
          actionType: 'PURGE_TRASH',
          title: `Purge Folder: ${folder.name}`,
          description: `Administrator ${req.user.fullName || req.user.email} requested permanent purge of folder "${folder.name}" and its credentials from Trash. Requires Super Admin approval.`,
          payload: {
            folderId: folder.id,
            folderName: folder.name,
            vaultId: folder.vaultId,
            vaultName: folder.vault?.name || 'Company Vault',
          },
          requesterId: req.user.id,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      await prisma.activityLog.create({
        data: {
          id: await generateId('activity'),
          userId: req.user.id,
          action: 'CREATE_APPROVAL_REQUEST',
          targetType: 'APPROVAL_REQUEST',
          targetId: approvalId,
          metadata: {
            actionType: 'PURGE_TRASH',
            folderId: folder.id,
            folderName: folder.name,
            vaultId: folder.vaultId,
          },
        },
      });

      return res.status(202).json({
        approvalRequired: true,
        message: `Super Admin Approval Required: Permanently purging folder requires authorization from a Super Admin. Pending request #${approvalId} submitted.`,
        approvalRequest,
      });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete all passwords in this folder
      await tx.passwordEntry.deleteMany({
        where: { folderId },
      });

      // 2. Delete permissions
      await tx.folderPermission.deleteMany({
        where: { folderId },
      });
      await tx.departmentPermission.deleteMany({
        where: { folderId },
      });

      // 3. Delete the folder itself
      await tx.folder.delete({
        where: { id: folderId },
      });

      await tx.activityLog.create({
        data: {
          id: await generateId('activityLog'),
          userId: req.user.id,
          action: 'DELETE_FOLDER',
          targetType: 'Folder',
          targetId: folderId,
          metadata: {
            name: folder.name,
            vaultId: folder.vaultId,
            folderId: folder.id,
            purged: true,
          },
        },
      });
    });

    res.json({ message: 'Folder and contents permanently deleted' });
  } catch (error) {
    console.error('Purge folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getFolderTrash = async (req, res) => {
  try {
    const { vaultId } = req.params;

    const vaultType = await getVaultType(vaultId);
    if (!vaultType || vaultType === 'PERSONAL') {
      return res.json([]);
    }

    const admin = await isAdminUser(req.user.id);
    const vaultAccess = await getVaultAccess(vaultId, req.user.id);
    const hasVaultLevelAccess =
      admin || (vaultAccess && ['ADMINISTRATOR', 'FULL_ACCESS'].includes(vaultAccess));

    if (hasVaultLevelAccess) {
      const trash = await prisma.folder.findMany({
        where: {
          vaultId,
          deletedAt: { not: null },
        },
        include: {
          _count: {
            select: { passwords: true },
          },
        },
        orderBy: { deletedAt: 'desc' },
      });

      return res.json(trash);
    }

    // Check folder permissions for non-admin users
    const memberOfIds = await getUserDepartmentIds(req.user.id);
    const departmentIds = await getDepartmentIdsWithAncestors(memberOfIds);

    const candidateFolders = await prisma.folder.findMany({
      where: {
        vaultId,
        deletedAt: { not: null },
        OR: [
          { permissions: { some: { userId: req.user.id } } },
          ...(departmentIds.length
            ? [{ departmentPermissions: { some: { departmentId: { in: departmentIds } } } }]
            : []),
        ],
      },
      include: {
        _count: {
          select: { passwords: true },
        },
      },
      orderBy: { deletedAt: 'desc' },
    });

    const allowed = [];
    for (const f of candidateFolders) {
      const access = await getFolderAccess(f.id, req.user.id);
      if (access && ['ADMINISTRATOR', 'FULL_ACCESS'].includes(access)) {
        allowed.push(f);
      }
    }

    res.json(allowed);
  } catch (error) {
    console.error('Get folder trash error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getFolderWrapRecipients = async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const access = await getFolderAccess(folder.id, req.user.id);
    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const userIds = await getFolderAuthorizedUserIds(folder.id);

    res.json({ userIds });
  } catch (error) {
    console.error('Get folder wrap recipients error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createFolder,
  updateFolder,
  getFoldersByVault,
  getFolderById,
  shareFolder,
  getFolderActivityLogs,
  deleteFolder,
  restoreFolder,
  purgeFolder,
  getFolderTrash,
  updateFolderPermission,
  deleteFolderPermission,
  getFolderWrapRecipients,
  blockFolderUser,
};