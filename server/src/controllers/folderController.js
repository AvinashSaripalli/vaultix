const prisma = require('../config/prisma');
const {
  isAdminUser,
  getFolderAccess,
  getFolderAuthorizedUserIds,
  getFolderDepartmentMembers,
  getUserDepartmentIds,
  getDepartmentIdsWithAncestors,
} = require('../utils/permissions');
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

    if (!existingFolder) {
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
    const admin = await isAdminUser(req.user.id);

    let folders;

    if (admin) {
      folders = await prisma.folder.findMany({
        where: { vaultId: req.params.vaultId },
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

    if (!folder) {
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
      return res.status(400).json({ message: 'The vault owner cannot be removed from the folder' });
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
      include: {
        passwords: true,
        permissions: true,
      },
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const access = await getFolderAccess(folderId, req.user.id);
    if (!access || access !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (folder.passwords.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete folder because it contains passwords',
      });
    }

    await prisma.$transaction([
      prisma.folderPermission.deleteMany({
        where: { folderId },
      }),
      prisma.folder.delete({
        where: { id: folderId },
      }),
      prisma.activityLog.create({
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
          },
        },
      }),
    ]);

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
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
  updateFolderPermission,
  deleteFolderPermission,
  getFolderWrapRecipients,
  blockFolderUser,
};