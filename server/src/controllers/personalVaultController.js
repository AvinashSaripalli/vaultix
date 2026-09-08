const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const { VALID_ITEM_TYPES, validateItemFields, validateLoginForType } = require('../utils/itemFieldSchemas');

const makeSlug = (name, userId) =>
  `${name}-${userId}`
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const ITEM_TYPES = VALID_ITEM_TYPES;

const getOrCreateMyVault = async (req, res) => {
  try {
    let vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
      include: {
        folders: {
          orderBy: { createdAt: 'asc' },
        },
        passwords: {
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
            folder: true,
          },
          where: {
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vault) {
      vault = await prisma.vault.create({
        data: {
          id: await generateId('vault'),
          name: 'My Vault',
          type: 'PERSONAL',
          slug: makeSlug('my-vault', req.user.id),
          ownerId: req.user.id,
        },
        include: {
          folders: true,
          passwords: true,
        },
      });

      await prisma.activityLog.create({
        data: {
          id: await generateId('activityLog'),
          userId: req.user.id,
          action: 'CREATE_VAULT',
          targetType: 'Vault',
          targetId: vault.id,
          metadata: {
            vaultId: vault.id,
            type: 'PERSONAL',
            personalVault: true,
          },
        },
      });
    }

    res.json(vault);
  } catch (error) {
    console.error('Get/Create my vault error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createMyVaultFolder = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Personal vault not found' });
    }

    const folder = await prisma.folder.create({
      data: {
        id: await generateId('folder'),
        name,
        vaultId: vault.id,
        parentId: null,
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'CREATE_FOLDER',
        targetType: 'Folder',
        targetId: folder.id,
        metadata: {
          vaultId: vault.id,
          folderId: folder.id,
          personalVault: true,
        },
      },
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error('Create my vault folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMyVaultFolders = async (req, res) => {
  try {
    const vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
    });

    if (!vault) {
      return res.json([]);
    }

    const folders = await prisma.folder.findMany({
      where: {
        vaultId: vault.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    res.json(folders);
  } catch (error) {
    console.error('Get my vault folders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createMyVaultPassword = async (req, res) => {
  try {
    const {
      name,
      login,
      encryptedPassword,
      encryptedNote,
      encryptedFields,
      url,
      colorTag,
      folderId,
      parentId,
      tags = [],
      type = 'LOGIN',
    } = req.body;

    if (!ITEM_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid item type' });
    }

    if (!name || !folderId) {
      return res.status(400).json({ message: 'name and folderId are required' });
    }

    const loginCheck = validateLoginForType(type, login);
    if (!loginCheck.valid) {
      return res.status(400).json({ message: loginCheck.message });
    }

    if (type === 'LOGIN' && !encryptedPassword) {
      return res.status(400).json({
        message: 'encryptedPassword is required for LOGIN items',
      });
    }

    if (encryptedFields && type !== 'LOGIN' && type !== 'SECURE_NOTE') {
      let parsedFields;
      try {
        parsedFields = typeof encryptedFields === 'string'
          ? JSON.parse(encryptedFields)
          : encryptedFields;
      } catch {
        return res.status(400).json({ message: 'encryptedFields must be valid JSON' });
      }
      const fieldCheck = validateItemFields(type, parsedFields);
      if (!fieldCheck.valid) {
        return res.status(400).json({ message: fieldCheck.message });
      }
    }

    const vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Personal vault not found' });
    }

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        vaultId: vault.id,
      },
    });

    if (!folder) {
      return res.status(403).json({ message: 'Invalid personal folder' });
    }

    if (parentId) {
      const parent = await prisma.passwordEntry.findFirst({
        where: { id: parentId, vaultId: vault.id },
      });

      if (!parent) {
        return res.status(400).json({ message: 'Invalid parent item' });
      }
    }

    const passwordEntry = await prisma.passwordEntry.create({
      data: {
        id: await generateId('passwordEntry'),
        name,
        login: login || '',
        type,
        encryptedPassword: encryptedPassword || '',
        encryptedFields,
        encryptedNote,
        url,
        colorTag,
        vaultId: vault.id,
        folderId,
        parentId: parentId || null,
        createdById: req.user.id,
        lastUpdatedAt: new Date(),
        strengthScore: req.body.strengthScore ?? 40,
        isWeak: req.body.isWeak ?? false,
        isSensitive: req.body.isSensitive ?? false,
        tags: {
          create: tags.map((tagName) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: {
                  id: generateId('tag'),
                  name: tagName,
                },
              },
            },
          })),
        },
      },
      include: {
        folder: true,
        parent: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'CREATE_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: passwordEntry.id,
        metadata: {
          name: passwordEntry.name,
          vaultId: vault.id,
          folderId,
          personalVault: true,
        },
      },
    });

    res.status(201).json(passwordEntry);
  } catch (error) {
    console.error('Create my vault password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMyVaultPasswords = async (req, res) => {
  try {
    const vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
    });

    if (!vault) {
      return res.json([]);
    }

    const passwords = await prisma.passwordEntry.findMany({
      where: {
        vaultId: vault.id,
        deletedAt: null,
      },
      include: {
        folder: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(passwords);
  } catch (error) {
    console.error('Get my vault passwords error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateMyVaultFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Personal vault not found' });
    }

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        vaultId: vault.id,
      },
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const updatedFolder = await prisma.folder.update({
      where: { id: folderId },
      data: { name },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'UPDATE_FOLDER',
        targetType: 'Folder',
        targetId: folder.id,
        metadata: {
          name: updatedFolder.name,
          vaultId: vault.id,
          folderId: folder.id,
          personalVault: true,
        },
      },
    });

    res.json(updatedFolder);
  } catch (error) {
    console.error('Update my vault folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteMyVaultFolder = async (req, res) => {
  try {
    const { folderId } = req.params;

    const vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Personal vault not found' });
    }

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        vaultId: vault.id,
      },
      include: {
        passwords: true,
      },
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    await prisma.folder.delete({
      where: { id: folderId },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'DELETE_FOLDER',
        targetType: 'Folder',
        targetId: folder.id,
        metadata: {
          name: folder.name,
          vaultId: vault.id,
          folderId: folder.id,
          personalVault: true,
        },
      },
    });

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete my vault folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateMyVaultPassword = async (req, res) => {
  try {
    const { passwordId } = req.params;

    const {
      name,
      login,
      encryptedPassword,
      encryptedNote,
      encryptedFields,
      url,
      colorTag,
      folderId,
      parentId,
      tags,
      type,
    } = req.body;

    if (type !== undefined && !ITEM_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid item type' });
    }

    if (type !== undefined) {
      const loginCheck = validateLoginForType(type, login);
      if (!loginCheck.valid) {
        return res.status(400).json({ message: loginCheck.message });
      }
    }

    if (encryptedFields !== undefined && encryptedFields) {
      const effectiveType = type || password.type;
      if (effectiveType !== 'LOGIN' && effectiveType !== 'SECURE_NOTE') {
        let parsedFields;
        try {
          parsedFields = typeof encryptedFields === 'string'
            ? JSON.parse(encryptedFields)
            : encryptedFields;
        } catch {
          return res.status(400).json({ message: 'encryptedFields must be valid JSON' });
        }
        const fieldCheck = validateItemFields(effectiveType, parsedFields);
        if (!fieldCheck.valid) {
          return res.status(400).json({ message: fieldCheck.message });
        }
      }
    }

    const cleanTags = Array.isArray(tags)
      ? tags
          .map((tag) => String(tag).trim())
          .filter(Boolean)
          .filter((tag, index, arr) => {
            return (
              arr.findIndex(
                (t) => t.toLowerCase() === tag.toLowerCase()
              ) === index
            );
          })
      : undefined;

    const vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Personal vault not found' });
    }

    const password = await prisma.passwordEntry.findFirst({
      where: {
        id: passwordId,
        vaultId: vault.id,
      },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (password.deletedAt) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          vaultId: vault.id,
        },
      });

      if (!folder) {
        return res.status(400).json({ message: 'Invalid folder' });
      }
    }

    let finalParentId = parentId === undefined ? undefined : parentId || null;

    if (finalParentId) {
      if (finalParentId === passwordId) {
        return res.status(400).json({ message: 'An item cannot be its own parent' });
      }

      const parent = await prisma.passwordEntry.findFirst({
        where: { id: finalParentId, vaultId: vault.id },
      });

      if (!parent) {
        return res.status(400).json({ message: 'Invalid parent item' });
      }

      let cursor = parent;
      while (cursor?.parentId) {
        if (cursor.parentId === passwordId) {
          return res.status(400).json({ message: 'Invalid parent item' });
        }
        cursor = await prisma.passwordEntry.findFirst({
          where: { id: cursor.parentId },
          select: { id: true, parentId: true },
        });
      }
    }

    const updatedPassword = await prisma.passwordEntry.update({
      where: { id: passwordId },
      data: {
        name,
        login,
        type,
        encryptedPassword,
        encryptedFields:
          encryptedFields !== undefined ? encryptedFields || null : undefined,
        encryptedNote,
        url,
        colorTag,
        folderId,
        parentId: finalParentId,
        lastUpdatedAt: new Date(),
        strengthScore: req.body.strengthScore ?? undefined,
        isWeak: req.body.isWeak ?? undefined,
        isOld: req.body.isOld ?? undefined,
        isAtRisk: req.body.isAtRisk ?? undefined,
        isSensitive: req.body.isSensitive ?? undefined,
        ...(cleanTags !== undefined && {
          tags: {
            deleteMany: {},
            create: cleanTags.map((tagName) => ({
              tag: {
                connectOrCreate: {
                  where: { name: tagName },
                  create: {
                    id: generateId('tag'),
                    name: tagName,
                  },
                },
              },
            })),
          },
        }),
      },
      include: {
        folder: true,
        parent: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'UPDATE_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: password.id,
        metadata: {
          name: updatedPassword.name,
          vaultId: vault.id,
          folderId,
          personalVault: true,
        },
      },
    });

    res.json(updatedPassword);
  } catch (error) {
    console.error('Update my vault password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const collectMyVaultSubtreeIds = async (rootId, vaultId) => {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    const rows = await prisma.passwordEntry.findMany({
      where: { vaultId, parentId: { in: [...ids] } },
      select: { id: true },
    });
    for (const row of rows) {
      if (!ids.has(row.id)) {
        ids.add(row.id);
        changed = true;
      }
    }
  }
  return [...ids];
};

const deleteMyVaultPassword = async (req, res) => {
  try {
    const { passwordId } = req.params;

    const vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Personal vault not found' });
    }

    const password = await prisma.passwordEntry.findFirst({
      where: {
        id: passwordId,
        vaultId: vault.id,
      },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    const subtreeIds = await collectMyVaultSubtreeIds(passwordId, vault.id);
    const now = new Date();

    await prisma.passwordEntry.updateMany({
      where: { id: { in: subtreeIds } },
      data: { deletedAt: now },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'DELETE_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: passwordId,
        metadata: {
          name: password.name,
          vaultId: vault.id,
          folderId: password.folderId,
          personalVault: true,
          softDelete: true,
        },
      },
    });

    res.json({ message: 'Password moved to trash' });
  } catch (error) {
    console.error('Delete my vault password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const restoreMyVaultPassword = async (req, res) => {
  try {
    const { passwordId } = req.params;

    const vault = await prisma.vault.findFirst({
      where: { ownerId: req.user.id, type: 'PERSONAL' },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Personal vault not found' });
    }

    const password = await prisma.passwordEntry.findFirst({
      where: { id: passwordId, vaultId: vault.id },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (!password.deletedAt) {
      return res.status(400).json({ message: 'Password is not in the trash' });
    }

    const subtreeIds = await collectMyVaultSubtreeIds(passwordId, vault.id);

    await prisma.passwordEntry.updateMany({
      where: { id: { in: subtreeIds } },
      data: { deletedAt: null },
    });

    res.json({ message: 'Password restored successfully' });
  } catch (error) {
    console.error('Restore my vault password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const purgeMyVaultPassword = async (req, res) => {
  try {
    const { passwordId } = req.params;

    const vault = await prisma.vault.findFirst({
      where: { ownerId: req.user.id, type: 'PERSONAL' },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Personal vault not found' });
    }

    const password = await prisma.passwordEntry.findFirst({
      where: { id: passwordId, vaultId: vault.id },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (!password.deletedAt) {
      return res.status(400).json({ message: 'Password is not in the trash' });
    }

    const subtreeIds = await collectMyVaultSubtreeIds(passwordId, vault.id);

    await prisma.passwordEntry.deleteMany({
      where: { id: { in: subtreeIds } },
    });

    res.json({ message: 'Password permanently deleted' });
  } catch (error) {
    console.error('Purge my vault password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMyVaultTrash = async (req, res) => {
  try {
    const vault = await prisma.vault.findFirst({
      where: { ownerId: req.user.id, type: 'PERSONAL' },
    });

    if (!vault) {
      return res.json([]);
    }

    const trash = await prisma.passwordEntry.findMany({
      where: {
        vaultId: vault.id,
        deletedAt: { not: null },
      },
      include: {
        folder: true,
        tags: { include: { tag: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });

    res.json(trash);
  } catch (error) {
    console.error('Get my vault trash error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPasswordShares = async (req, res) => {
  try {
    const { passwordId } = req.params;

    const vault = await prisma.vault.findFirst({
      where: {
        ownerId: req.user.id,
        type: 'PERSONAL',
      },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Personal vault not found' });
    }

    const password = await prisma.passwordEntry.findFirst({
      where: {
        id: passwordId,
        vaultId: vault.id,
      },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    const shares = await prisma.passwordShare.findMany({
      where: { passwordId },
      include: {
        sharedWith: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(shares);
  } catch (error) {
    console.error('Get password shares error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getOrCreateMyVault,
  createMyVaultFolder,
  getMyVaultFolders,
  createMyVaultPassword,
  getMyVaultPasswords,
  updateMyVaultFolder,
  deleteMyVaultFolder,
  updateMyVaultPassword,
  deleteMyVaultPassword,
  restoreMyVaultPassword,
  purgeMyVaultPassword,
  getMyVaultTrash,
  getPasswordShares,
};