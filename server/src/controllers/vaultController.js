const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const {
  getVaultAccess,
  getUserDepartmentIds,
  getDepartmentIdsWithAncestors,
  getFolderDepartmentMembers,
} = require('../utils/permissions');
const { revokeWrappedKeysForUser } = require('../utils/wrappedKeys');

const ALLOWED_VAULT_ACCESS_LEVELS = ['READ_ONLY', 'READ_WRITE', 'FULL_ACCESS', 'ADMINISTRATOR'];

const makeSlug = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const createVault = async (req, res) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admin can create vaults' });
    }

    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }

    const baseSlug = makeSlug(name);
    let slug = baseSlug;
    let count = 1;

    while (await prisma.vault.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${count}`;
      count += 1;
    }

    const vaultId = await generateId('vault');

    const vault = await prisma.vault.create({
      data: {
        id: vaultId,
        name,
        type,
        slug,
        ownerId: req.user.id,
      },
    });

    const vaultPermissionId = await generateId('vaultPermission');

    await prisma.vaultPermission.create({
      data: {
        id: vaultPermissionId,
        vaultId: vault.id,
        userId: req.user.id,
        accessLevel: 'ADMINISTRATOR',
      },
    });

    const activityId = await generateId('activityLog');

    await prisma.activityLog.create({
      data: {
        id: activityId,
        userId: req.user.id,
        action: 'CREATE_VAULT',
        targetType: 'Vault',
        targetId: vault.id,
        metadata: {
          name: vault.name,
          type: vault.type,
          slug: vault.slug,
        },
      },
    });

    res.status(201).json(vault);
  } catch (error) {
    console.error('Create vault error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getVaults = async (req, res) => {
  try {
    let vaults;

    if (['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      vaults = await prisma.vault.findMany({
  where: {
    type: {
      not: 'PERSONAL',
    },
  },
  include: {
    permissions: {
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    },
    folders: {
      where: { deletedAt: null },
      include: {
        permissions: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    },
    passwords: {
      select: {
        id: true,
        name: true,
        login: true,
        createdAt: true,
      },
    },
  },
  orderBy: { createdAt: 'desc' },
});
    } else {
      const memberOfIds = await getUserDepartmentIds(req.user.id);
      const departmentIds = await getDepartmentIdsWithAncestors(memberOfIds);

      // A folder is visible if the user has a direct (non-forbidden) grant,
      // OR access via a department they belong to (including parent
      // departments), granted directly on the folder.
      const folderAccessFilter = {
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
      };

      const candidateFoldersForVaults = await prisma.folder.findMany({
        where: folderAccessFilter,
        select: { id: true, vaultId: true, blockedUserIds: true, permissions: { select: { userId: true, accessLevel: true } } },
      });

      const validFoldersForVaults = candidateFoldersForVaults.filter((f) => {
        const blocked = Array.isArray(f.blockedUserIds) ? f.blockedUserIds : [];
        if (!blocked.includes(req.user.id)) return true;
        return f.permissions.some((p) => p.userId === req.user.id && p.accessLevel !== 'FORBIDDEN');
      });

      const vaultIds = [...new Set(validFoldersForVaults.map((item) => item.vaultId))];
      const validFolderIds = validFoldersForVaults.map((f) => f.id);

      if (!vaultIds.length) {
        vaults = [];
      } else {
        vaults = await prisma.vault.findMany({
          where: { id: { in: vaultIds } },
          include: {
            folders: {
              where: { id: { in: validFolderIds } },
              include: {
                permissions: {
                  include: {
                    user: {
                      select: { id: true, fullName: true, email: true },
                    },
                  },
                },
              },
            },
            passwords: false,
            permissions: false,
          },
        });

        // Attach departmentMembers + myWrappedKey for each folder so sidebar can compute access correctly
        const allFolderIds = vaults.flatMap((v) => v.folders.map((f) => f.id));
        if (allFolderIds.length) {
          const withKeys = await prisma.folder.findMany({
            where: { id: { in: allFolderIds } },
            select: { id: true, wrappedKeys: true },
          });
          const keyMap = new Map(withKeys.map((f) => [f.id, f.wrappedKeys]));
          for (const vault of vaults) {
            for (const folder of vault.folders) {
              const allWrapped = keyMap.get(folder.id) || {};
              folder.myWrappedKey = allWrapped[req.user.id] || null;
              // Attach departmentMembers for access level display
              folder.departmentMembers = await getFolderDepartmentMembers(folder.id);
            }
          }
        }
      }
    }

    res.json(vaults);
  } catch (error) {
    console.error('Get vaults error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getVaultBySlug = async (req, res) => {
  try {
    let vault;

    if (['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      vault = await prisma.vault.findUnique({
        where: { slug: req.params.slug },
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
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
          folders: {
            where: { deletedAt: null },
            include: {
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
    } else {
      const targetVault = await prisma.vault.findUnique({
        where: { slug: req.params.slug },
        select: { id: true },
      });

      if (!targetVault) {
        return res.status(404).json({ message: 'Vault not found' });
      }

      const memberOfIds = await getUserDepartmentIds(req.user.id);
      const departmentIds = await getDepartmentIdsWithAncestors(memberOfIds);

      const folderAccessFilter = {
        vaultId: targetVault.id,
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
      };

      const candidateAccessible = await prisma.folder.findMany({
        where: folderAccessFilter,
        select: { id: true, blockedUserIds: true, permissions: { select: { userId: true, accessLevel: true } } },
      });

      const validAccessible = candidateAccessible.filter((f) => {
        const blocked = Array.isArray(f.blockedUserIds) ? f.blockedUserIds : [];
        if (!blocked.includes(req.user.id)) return true;
        return f.permissions.some((p) => p.userId === req.user.id && p.accessLevel !== 'FORBIDDEN');
      });

      if (!validAccessible.length) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const validIds = validAccessible.map((f) => f.id);

      vault = await prisma.vault.findUnique({
        where: { slug: req.params.slug },
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          folders: {
            where: { id: { in: validIds } },
            include: {
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
            },
          },
        },
      });
    }

    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    if (vault.folders?.length) {
      const enriched = await Promise.all(
        vault.folders.map(async (folder) => {
          const allWrappedKeys = folder.wrappedKeys || {};
          const myWrappedKey = allWrappedKeys[req.user.id] || null;
          const { wrappedKeys, ...rest } = folder;
          let departmentMembers = [];
          // Attach department members so client can show them in permissions/members UI and compute access
          try {
            departmentMembers = await getFolderDepartmentMembers(folder.id);
          } catch {
            departmentMembers = [];
          }
          return { ...rest, myWrappedKey, departmentMembers };
        })
      );
      vault = { ...vault, folders: enriched };
    } else if (vault.folders) {
      const extractMyWrappedKey = (folders) =>
        folders.map((folder) => {
          const allWrappedKeys = folder.wrappedKeys || {};
          const myWrappedKey = allWrappedKeys[req.user.id] || null;
          const { wrappedKeys, ...rest } = folder;
          return { ...rest, myWrappedKey };
        });
      vault = { ...vault, folders: extractMyWrappedKey(vault.folders) };
    }

    res.json(vault);
  } catch (error) {
    console.error('Get vault by slug error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const shareVault = async (req, res) => {
  try {
    const vaultId = req.params.id;
    const { userEmail, accessLevel } = req.body;

    if (!vaultId) {
      return res.status(400).json({ message: 'Vault id is required' });
    }

    if (!userEmail || !accessLevel) {
      return res.status(400).json({ message: 'userEmail and accessLevel are required' });
    }

    if (!ALLOWED_VAULT_ACCESS_LEVELS.includes(accessLevel)) {
      return res.status(400).json({
        message: `Invalid access level. Must be one of: ${ALLOWED_VAULT_ACCESS_LEVELS.join(', ')}`,
      });
    }

    const vault = await prisma.vault.findUnique({
      where: { id: vaultId },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    if (vault.type === 'PERSONAL') {
      return res.status(400).json({ message: 'Personal vaults cannot be shared' });
    }

    const access = await getVaultAccess(vaultId, req.user.id);
    if (access !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot share vault with yourself' });
    }

    const permission = await prisma.vaultPermission.upsert({
      where: {
        vaultId_userId: {
          vaultId,
          userId: user.id,
        },
      },
      update: {
        accessLevel,
      },
      create: {
        id: await generateId('vaultPermission'),
        vaultId,
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

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'SHARE_VAULT',
        targetType: 'Vault',
        targetId: vaultId,
        metadata: {
          vaultId,
          name: vault.name,
          sharedWith: user.email,
          accessLevel,
        },
      },
    });

    res.status(201).json(permission);
  } catch (error) {
    console.error('Share vault error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const unshareVault = async (req, res) => {
  try {
    const vaultId = req.params.id;
    const { userId } = req.body;

    if (!vaultId || !userId) {
      return res.status(400).json({ message: 'vaultId and userId are required' });
    }

    const vault = await prisma.vault.findUnique({ where: { id: vaultId } });
    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    const access = await getVaultAccess(vaultId, req.user.id);
    if (access !== 'ADMINISTRATOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot remove yourself' });
    }

    await prisma.vaultPermission.deleteMany({
      where: { vaultId, userId },
    });

    await revokeWrappedKeysForUser(vaultId, userId);

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'UNSHARE_VAULT',
        targetType: 'Vault',
        targetId: vaultId,
        metadata: { vaultId, removedUserId: userId },
      },
    });

    res.json({ message: 'Vault access removed and wrapped keys revoked' });
  } catch (error) {
    console.error('Unshare vault error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getVaultPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const vault = await prisma.vault.findUnique({
      where: { id },
      select: {
        type: true,
        minStrengthScore: true,
        maxAgeDays: true,
        blockCommon: true,
        allowedTypes: true,
      },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    res.json({
      minStrengthScore: vault.minStrengthScore ?? null,
      maxAgeDays: vault.maxAgeDays ?? null,
      blockCommon: vault.blockCommon ?? false,
      allowedTypes: Array.isArray(vault.allowedTypes) ? vault.allowedTypes : null,
    });
  } catch (error) {
    console.error('Get vault policy error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const setVaultPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const { minStrengthScore, maxAgeDays, blockCommon, allowedTypes } = req.body;

    const vault = await prisma.vault.findUnique({ where: { id } });
    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }
    if (vault.type === 'PERSONAL') {
      return res.status(400).json({ message: 'Policies cannot be set on personal vaults' });
    }
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      const access = await getVaultAccess(id, req.user.id);
      if (access !== 'ADMINISTRATOR') {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const data = {};

    if (minStrengthScore !== undefined) {
      if (minStrengthScore !== null && (!Number.isInteger(minStrengthScore) || minStrengthScore < 1 || minStrengthScore > 5)) {
        return res.status(400).json({ message: 'minStrengthScore must be an integer between 1 and 5' });
      }
      data.minStrengthScore = minStrengthScore;
    }

    if (maxAgeDays !== undefined) {
      if (maxAgeDays !== null && (!Number.isInteger(maxAgeDays) || maxAgeDays < 1)) {
        return res.status(400).json({ message: 'maxAgeDays must be a positive integer' });
      }
      data.maxAgeDays = maxAgeDays;
    }

    if (blockCommon !== undefined) {
      data.blockCommon = !!blockCommon;
    }

    if (allowedTypes !== undefined) {
      if (allowedTypes !== null && !Array.isArray(allowedTypes)) {
        return res.status(400).json({ message: 'allowedTypes must be an array' });
      }
      data.allowedTypes = allowedTypes;
    }

    const updated = await prisma.vault.update({
      where: { id },
      data,
      select: {
        minStrengthScore: true,
        maxAgeDays: true,
        blockCommon: true,
        allowedTypes: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'UPDATE_VAULT',
        targetType: 'Vault',
        targetId: id,
        metadata: { vaultId: id, policyUpdated: true, ...data },
      },
    });

    res.json({
      minStrengthScore: updated.minStrengthScore ?? null,
      maxAgeDays: updated.maxAgeDays ?? null,
      blockCommon: updated.blockCommon ?? false,
      allowedTypes: Array.isArray(updated.allowedTypes) ? updated.allowedTypes : null,
    });
  } catch (error) {
    console.error('Set vault policy error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createVault,
  getVaults,
  getVaultBySlug,
  shareVault,
  unshareVault,
  getVaultPolicy,
  setVaultPolicy,
};