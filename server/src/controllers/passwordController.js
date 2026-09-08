const prisma = require('../config/prisma');
const {
  getFolderAccess,
  isAdminUser,
  getFolderAuthorizedUserIds,
  getVaultAccess,
  getUserDepartmentIds,
  getDepartmentIdsWithAncestors,
} = require('../utils/permissions');
const generateId = require('../utils/generateId');
const { VALID_ITEM_TYPES, validateItemFields, validateLoginForType } = require('../utils/itemFieldSchemas');
const { getVaultPolicy, validateAgainstPolicy } = require('../utils/vaultPolicy');

const getVaultType = async (vaultId) => {
  try {
    const vault = await prisma.vault.findUnique({
      where: { id: vaultId },
      select: { type: true },
    });
    return vault?.type || null;
  } catch {
    return null;
  }
};

const toClientPassword = (pw, userId) => {
  const allWrappedKeys = pw.wrappedKeys || {};
  const { wrappedKeys, ...rest } = pw;
  return {
    ...rest,
    myWrappedKey: allWrappedKeys[userId] || null,
    wrappedUserIds: Object.keys(allWrappedKeys),
  };
};

// Wrapped keys must only ever be stored for recipients that are currently
// authorized for the folder. This prevents an authorized writer from injecting
// (or overwriting) wrapped keys belonging to someone else, which would silently
// break that user's ability to decrypt the shared item.
const validateWrappedKeys = async (folderId, wrappedKeys) => {
  if (
    !wrappedKeys ||
    typeof wrappedKeys !== 'object' ||
    Array.isArray(wrappedKeys)
  ) {
    return false;
  }

  const keys = Object.keys(wrappedKeys);
  if (keys.length === 0) return false;

  const authorized = new Set(await getFolderAuthorizedUserIds(folderId));

  return keys.every(
    (uid) => authorized.has(uid) && typeof wrappedKeys[uid] === 'string' && wrappedKeys[uid].length > 0
  );
};

const createPassword = async (req, res) => {
  try {
    const {
      name,
      login,
      encryptedPassword,
      encryptedNote,
      encryptedFields,
      url,
      colorTag,
      vaultId,
      folderId,
      wrappedKeys,
      type = 'LOGIN',
      tags = [],
    } = req.body;

    const itemtype = type || 'LOGIN';

    if (!VALID_ITEM_TYPES.includes(itemtype)) {
      return res.status(400).json({ message: `Invalid item type: ${itemtype}` });
    }

    if (!name || !vaultId || !folderId) {
      return res.status(400).json({
        message: 'name, vaultId and folderId are required',
      });
    }

    const loginCheck = validateLoginForType(itemtype, login);
    if (!loginCheck.valid) {
      return res.status(400).json({ message: loginCheck.message });
    }

    if (itemtype === 'LOGIN' && !encryptedPassword) {
      return res.status(400).json({
        message: 'encryptedPassword is required for LOGIN items',
      });
    }

    if (encryptedFields && itemtype !== 'LOGIN' && itemtype !== 'SECURE_NOTE') {
      let parsedFields;
      try {
        parsedFields = typeof encryptedFields === 'string'
          ? JSON.parse(encryptedFields)
          : encryptedFields;
      } catch {
        return res.status(400).json({ message: 'encryptedFields must be valid JSON' });
      }
      const fieldCheck = validateItemFields(itemtype, parsedFields);
      if (!fieldCheck.valid) {
        return res.status(400).json({ message: fieldCheck.message });
      }
    }

    const access = await getFolderAccess(folderId, req.user.id);
    if (!access || !['ADMINISTRATOR', 'READ_WRITE', 'FULL_ACCESS'].includes(access)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // The folder must belong to the vault the caller claims — otherwise a user
    // could plant items in a vault they do not have access to.
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { vaultId: true },
    });
    if (!folder || folder.vaultId !== vaultId) {
      return res.status(400).json({ message: 'Folder does not belong to the given vault' });
    }

    const vaultTypeForGuard = await getVaultType(vaultId);

    // Company/client vault items must carry a wrapped key for the creator,
    // otherwise the AES item key would be discarded and the data lost forever.
    if (
      vaultTypeForGuard &&
      vaultTypeForGuard !== 'PERSONAL' &&
      (!wrappedKeys ||
        typeof wrappedKeys !== 'object' ||
        !wrappedKeys[req.user.id])
    ) {
      return res.status(400).json({
        message:
          'Encryption keys not ready — missing wrapped key for creator. Please re-enter your master password and retry.',
      });
    }

    // Wrapped keys may only target recipients currently authorized in the folder.
    if (wrappedKeys && Object.keys(wrappedKeys).length > 0) {
      if (!(await validateWrappedKeys(folderId, wrappedKeys))) {
        return res.status(400).json({ message: 'Wrapped keys contain unauthorized recipients' });
      }
    }

    const isWeak = req.body.isWeak ?? false;
    const isOld = req.body.isOld ?? false;
    const isAtRisk = req.body.isAtRisk ?? false;
    const isSensitive = req.body.isSensitive ?? false;
    const strengthScore = req.body.strengthScore ?? 40;

    const vaultPolicy = await getVaultPolicy(vaultId);
    if (vaultPolicy) {
      const policyCheck = validateAgainstPolicy(vaultPolicy, {
        strengthScore,
        isWeak,
        isAtRisk,
        type: itemtype,
      });
      if (!policyCheck.valid) {
        return res.status(400).json({ message: policyCheck.message });
      }
    }

    const passwordEntry = await prisma.passwordEntry.create({
      data: {
        id: await generateId('passwordEntry'),
        name,
        login: login || '',
        type: itemtype,
        encryptedPassword: encryptedPassword || '',
        encryptedNote,
        encryptedFields: encryptedFields || null,
        url,
        colorTag,
        vaultId,
        folderId,
        createdById: req.user.id,
        isWeak,
        isOld,
        isAtRisk,
        isSensitive,
        strengthScore,
        wrappedKeys: wrappedKeys || null,
        lastUpdatedAt: new Date(),
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
        tags: {
          include: { tag: true },
        },
      },
    });

    const vaultType = await getVaultType(vaultId);

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'CREATE_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: passwordEntry.id,
        metadata: {
          name: passwordEntry.name,
          vaultId,
          folderId,
          vaultType,
        },
      },
    });

    const allWrappedKeys = passwordEntry.wrappedKeys || {};
    const myWrappedKey = allWrappedKeys[req.user.id] || null;
    const { wrappedKeys: _wk, ...passwordData } = passwordEntry;

    res.status(201).json({ ...passwordData, myWrappedKey, wrappedUserIds: Object.keys(allWrappedKeys) });
  } catch (error) {
    console.error('Create password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const importPasswordsFromExcel = async (req, res) => {
  try {
    const { vaultId, folderId, rows } = req.body;

    if (!vaultId || !folderId) {
      return res.status(400).json({ message: 'vaultId and folderId required' });
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'rows array is required' });
    }

    if (rows.length > 500) {
      return res.status(400).json({ message: 'Cannot import more than 500 passwords at once' });
    }

    const access = await getFolderAccess(folderId, req.user.id);
    if (!access || !['ADMINISTRATOR', 'READ_WRITE', 'FULL_ACCESS'].includes(access)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const importFolder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { vaultId: true },
    });
    if (!importFolder || importFolder.vaultId !== vaultId) {
      return res.status(400).json({ message: 'Folder does not belong to the given vault' });
    }

    const vaultTypeForGuard = await getVaultType(vaultId);

    for (const row of rows) {
      const rowType = row.type || 'LOGIN';

      if (!VALID_ITEM_TYPES.includes(rowType)) continue;

      if (!row.name) continue;
      if (rowType === 'LOGIN' && !row.encryptedPassword) continue;
      if (rowType !== 'LOGIN' && rowType !== 'SECURE_NOTE' && !row.encryptedFields) continue;

      const rowLoginCheck = validateLoginForType(rowType, row.login);
      if (!rowLoginCheck.valid) continue;

      if (row.encryptedFields && rowType !== 'LOGIN' && rowType !== 'SECURE_NOTE') {
        let parsedFields;
        try {
          parsedFields = typeof row.encryptedFields === 'string'
            ? JSON.parse(row.encryptedFields)
            : row.encryptedFields;
        } catch {
          return res.status(400).json({ message: `Row "${row.name}" has invalid encryptedFields` });
        }
        const fieldCheck = validateItemFields(rowType, parsedFields);
        if (!fieldCheck.valid) {
          return res.status(400).json({ message: `Row "${row.name}": ${fieldCheck.message}` });
        }
      }

      if (
        vaultTypeForGuard &&
        vaultTypeForGuard !== 'PERSONAL' &&
        (!row.wrappedKeys ||
          typeof row.wrappedKeys !== 'object' ||
          !row.wrappedKeys[req.user.id])
      ) {
        return res.status(400).json({
          message:
            'Encryption keys not ready — missing wrapped key for importer. Please re-enter your master password and retry.',
        });
      }

      // Same guarantee as createPassword: wrapped keys may only target
      // recipients currently authorized in the folder, never arbitrary users.
      if (row.wrappedKeys && Object.keys(row.wrappedKeys).length > 0) {
        if (!(await validateWrappedKeys(folderId, row.wrappedKeys))) {
          return res.status(400).json({ message: 'Wrapped keys contain unauthorized recipients' });
        }
      }
    }

    const createdPasswords = [];

    for (const row of rows) {
      const rowType = row.type || 'LOGIN';
      if (!VALID_ITEM_TYPES.includes(rowType)) continue;

      if (!row.name) continue;
      if (rowType === 'LOGIN' && !row.encryptedPassword) continue;
      if (rowType !== 'LOGIN' && rowType !== 'SECURE_NOTE' && !row.encryptedFields) continue;

      const created = await prisma.passwordEntry.create({
        data: {
          id: await generateId('passwordEntry'),
          name: row.name,
          login: row.login || '',
          type: rowType,
          encryptedPassword: row.encryptedPassword || '',
          encryptedNote: row.encryptedNote || '',
          encryptedFields: row.encryptedFields || null,
          url: row.url || '',
          vaultId,
          folderId,
          createdById: req.user.id,
          lastUpdatedAt: new Date(),
          strengthScore: row.strengthScore ?? 40,
          isWeak: row.isWeak ?? false,
          isOld: row.isOld ?? false,
          isAtRisk: row.isAtRisk ?? false,
          isSensitive: row.isSensitive ?? false,
          wrappedKeys: row.wrappedKeys || null,
          tags: {
            create: Array.isArray(row.tags)
              ? row.tags.map((tagName) => ({
                  tag: {
                    connectOrCreate: {
                      where: { name: tagName },
                      create: {
                        id: generateId('tag'),
                        name: tagName,
                      },
                    },
                  },
                }))
              : [],
          },
        },
      });

      createdPasswords.push(created);
    }

    const result = createdPasswords.map((pw) => toClientPassword(pw, req.user.id));

    res.json({
      message: 'Imported successfully',
      count: result.length,
      passwords: result,
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPasswordsByVault = async (req, res) => {
  try {
    const admin = await isAdminUser(req.user.id);

    let passwords;

    if (admin) {
      passwords = await prisma.passwordEntry.findMany({
        where: {
          vaultId: req.params.vaultId,
          deletedAt: null,
        },
        include: {
          tags: { include: { tag: true } },
          folder: true,
          createdBy: {
            select: { id: true, encryptionSalt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      const memberOfIds = await getUserDepartmentIds(req.user.id);
      const departmentIds = await getDepartmentIdsWithAncestors(memberOfIds);

      // Fetch candidate folders where user has ANY relation (direct or via department, including FORBIDDEN) - password visibility will be filtered by effective access
      const candidateFolders = await prisma.folder.findMany({
        where: {
          vaultId: req.params.vaultId,
          OR: [
            { permissions: { some: { userId: req.user.id } } },
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
        // Check blocked: blocked loses department access unless direct non-FORBIDDEN exists
        const hasDirectNonForbidden = f.permissions.some((p) => p.userId === req.user.id && p.accessLevel !== 'FORBIDDEN');
        const blocked = Array.isArray(f.blockedUserIds) ? f.blockedUserIds : [];
        const isBlocked = blocked.includes(req.user.id) && !hasDirectNonForbidden;

        // Department access with FORBIDDEN precedence
        const deptGrants = f.departmentPermissions.filter((g) => departmentIds.includes(g.departmentId));
        const hasDeptForbidden = deptGrants.some((g) => g.accessLevel === 'FORBIDDEN');
        let deptAccess = null;
        if (!hasDeptForbidden) {
          const levels = deptGrants.map((g) => DEPT_TO_FOLDER_MAP[g.accessLevel]).filter(Boolean);
          deptAccess = getHighest(levels);
        } else {
          // FORBIDDEN is explicit deny - no access via department or direct (direct cannot override)
          continue;
        }

        const directPerm = f.permissions.find((p) => p.userId === req.user.id);
        if (directPerm) {
          if (directPerm.accessLevel === 'FORBIDDEN') continue; // explicit deny wins -> no password access
          const directAccess = directPerm.accessLevel;
          const effective = getHighest([directAccess, deptAccess]);
          if (effective && !isBlocked) accessibleFolderIds.push(f.id);
          continue;
        }

        if (isBlocked) continue;
        if (deptAccess) accessibleFolderIds.push(f.id);
      }
      const folderIds = accessibleFolderIds.filter(Boolean);

      if (!folderIds.length) {
        passwords = [];
      } else {
        passwords = await prisma.passwordEntry.findMany({
          where: {
            vaultId: req.params.vaultId,
            folderId: { in: folderIds },
            deletedAt: null,
          },
          include: {
            tags: { include: { tag: true } },
            folder: true,
            createdBy: {
              select: { id: true, encryptionSalt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    const userId = req.user.id;
    const result = passwords.map((pw) => toClientPassword(pw, userId));

    res.json(result);
  } catch (error) {
    console.error('Get passwords by vault error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPasswordById = async (req, res) => {
  try {
    const password = await prisma.passwordEntry.findUnique({
      where: { id: req.params.id },
      include: {
        tags: { include: { tag: true } },
        folder: true,
        vault: true,
        createdBy: {
          select: { id: true, encryptionSalt: true },
        },
      },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (password.deletedAt) {
      return res.status(404).json({ message: 'Password not found' });
    }

    const access = await getFolderAccess(password.folderId, req.user.id);
    if (!access || !['ADMINISTRATOR', 'READ_WRITE', 'READ_ONLY', 'FULL_ACCESS'].includes(access)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const vaultType = await getVaultType(password.vaultId);

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'VIEW_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: password.id,
        metadata: {
          name: password.name,
          folderId: password.folderId,
          vaultId: password.vaultId,
          vaultType,
        },
      },
    });

    const allWrappedKeys = password.wrappedKeys || {};
    const { wrappedKeys, ...passwordData } = password;

    res.json({
      ...passwordData,
      myWrappedKey: allWrappedKeys[req.user.id] || null,
      wrappedUserIds: Object.keys(allWrappedKeys),
    });
  } catch (error) {
    console.error('Get password by id error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updatePassword = async (req, res) => {
  try {
    const existingPassword = await prisma.passwordEntry.findUnique({
      where: { id: req.params.id },
      include: {
        tags: true,
      },
    });

    if (!existingPassword) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (existingPassword.deletedAt) {
      return res.status(404).json({ message: 'Password not found' });
    }

    const access = await getFolderAccess(existingPassword.folderId, req.user.id);

    if (
      !access ||
      !['ADMINISTRATOR', 'READ_WRITE', 'FULL_ACCESS'].includes(access)
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      name,
      login,
      encryptedPassword,
      encryptedNote,
      encryptedFields,
      url,
      colorTag,
      folderId,
      wrappedKeys,
      type,
      tags,
    } = req.body;

    if (type !== undefined && !VALID_ITEM_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid item type: ${type}` });
    }

    const effectiveType = type || existingPassword.type;

    if (encryptedFields !== undefined && encryptedFields && effectiveType !== 'LOGIN' && effectiveType !== 'SECURE_NOTE') {
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

    // Moving an entry across vaults would let a user with write access to one
    // folder relocate the item into a vault/folder they control. Only same-vault
    // folder moves are allowed.
    if (folderId !== undefined && folderId && folderId !== existingPassword.folderId) {
      const targetFolder = await prisma.folder.findUnique({
        where: { id: folderId },
        select: { vaultId: true },
      });
      if (!targetFolder || targetFolder.vaultId !== existingPassword.vaultId) {
        return res.status(400).json({ message: 'Folder does not belong to the same vault' });
      }
    }

    const effectiveFolderId = folderId || existingPassword.folderId;

    // Wrapped keys may only target recipients currently authorized in the
    // folder the entry will live in after this update.
    if (wrappedKeys && Object.keys(wrappedKeys).length > 0) {
      if (!(await validateWrappedKeys(effectiveFolderId, wrappedKeys))) {
        return res.status(400).json({ message: 'Wrapped keys contain unauthorized recipients' });
      }
    }

    const vaultTypeForGuard = await getVaultType(existingPassword.vaultId);

    // When the secret itself is re-encrypted, a wrapped key for the editor is
    // mandatory — otherwise every other user (and possibly the editor) would
    // permanently lose decrypt access.
    if (
      vaultTypeForGuard &&
      vaultTypeForGuard !== 'PERSONAL' &&
      encryptedPassword !== undefined &&
      (!wrappedKeys ||
        typeof wrappedKeys !== 'object' ||
        !wrappedKeys[req.user.id])
    ) {
      return res.status(400).json({
        message:
          'Encryption keys not ready — missing wrapped key for editor. Please re-enter your master password and retry.',
      });
    }

    const cleanTags = Array.isArray(tags)
      ? tags
          .map((tag) => String(tag).trim())
          .filter(Boolean)
          .filter((tag, index, arr) => {
            return (
              arr.findIndex(
                (item) => item.toLowerCase() === tag.toLowerCase()
              ) === index
            );
          })
      : undefined;

    const vaultPolicy = await getVaultPolicy(existingPassword.vaultId);
    if (vaultPolicy) {
      const policyCheck = validateAgainstPolicy(vaultPolicy, {
        strengthScore: req.body.strengthScore ?? existingPassword.strengthScore,
        isWeak: req.body.isWeak ?? existingPassword.isWeak,
        isAtRisk: req.body.isAtRisk ?? existingPassword.isAtRisk,
        type: effectiveType,
      });
      if (!policyCheck.valid) {
        return res.status(400).json({ message: policyCheck.message });
      }
    }

    const updatedPassword = await prisma.passwordEntry.update({
      where: { id: req.params.id },
      data: {
        name,
        login,
        type: type || undefined,
        encryptedPassword,
        encryptedNote,
        encryptedFields: encryptedFields !== undefined ? encryptedFields || null : undefined,
        url,
        colorTag,
        folderId: folderId === undefined ? undefined : folderId,
        lastUpdatedAt: new Date(),
        strengthScore: req.body.strengthScore ?? undefined,
        isWeak: req.body.isWeak ?? undefined,
        isOld: req.body.isOld ?? undefined,
        isAtRisk: req.body.isAtRisk ?? undefined,
        isSensitive: req.body.isSensitive ?? undefined,
        ...(wrappedKeys !== undefined && { wrappedKeys }),

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
        tags: {
          include: {
            tag: true,
          },
        },
        folder: true,
      },
    });

    const vaultType = await getVaultType(updatedPassword.vaultId);

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'UPDATE_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: updatedPassword.id,
        metadata: {
          name: updatedPassword.name,
          folderId: updatedPassword.folderId,
          vaultId: updatedPassword.vaultId,
          tags: cleanTags || undefined,
          vaultType,
        },
      },
    });

    const allWrappedKeysUpdated = updatedPassword.wrappedKeys || {};
    const { wrappedKeys: _wk, ...passwordData } = updatedPassword;

    res.json({
      ...passwordData,
      myWrappedKey: allWrappedKeysUpdated[req.user.id] || null,
      wrappedUserIds: Object.keys(allWrappedKeysUpdated),
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Collect the entry's id and all its descendants (via parentId) so a single
// soft-delete/restore covers a whole nested item tree at once.
const collectSubtreeIds = async (rootId) => {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    const rows = await prisma.passwordEntry.findMany({
      where: { parentId: { in: [...ids] } },
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

const deletePassword = async (req, res) => {
  try {
    const password = await prisma.passwordEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    const access = await getFolderAccess(password.folderId, req.user.id);
    if (!access || !['ADMINISTRATOR', 'FULL_ACCESS'].includes(access)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const subtreeIds = await collectSubtreeIds(req.params.id);

    const now = new Date();
    await prisma.passwordEntry.updateMany({
      where: { id: { in: subtreeIds } },
      data: { deletedAt: now },
    });

    const vaultType = await getVaultType(password.vaultId);

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'DELETE_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: req.params.id,
        metadata: {
          name: password.name,
          folderId: password.folderId,
          vaultId: password.vaultId,
          vaultType,
          softDelete: true,
        },
      },
    });

    res.json({ message: 'Password moved to trash' });
  } catch (error) {
    console.error('Delete password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const restorePassword = async (req, res) => {
  try {
    const password = await prisma.passwordEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (!password.deletedAt) {
      return res.status(400).json({ message: 'Password is not in the trash' });
    }

    const access = await getFolderAccess(password.folderId, req.user.id);
    if (!access || !['ADMINISTRATOR', 'FULL_ACCESS'].includes(access)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const subtreeIds = await collectSubtreeIds(req.params.id);

    await prisma.passwordEntry.updateMany({
      where: { id: { in: subtreeIds } },
      data: { deletedAt: null },
    });

    const vaultType = await getVaultType(password.vaultId);

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'UPDATE_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: req.params.id,
        metadata: {
          name: password.name,
          folderId: password.folderId,
          vaultId: password.vaultId,
          vaultType,
          restored: true,
        },
      },
    });

    res.json({ message: 'Password restored successfully' });
  } catch (error) {
    console.error('Restore password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const purgePassword = async (req, res) => {
  try {
    const password = await prisma.passwordEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (!password.deletedAt) {
      return res.status(400).json({ message: 'Password is not in the trash' });
    }

    const access = await getFolderAccess(password.folderId, req.user.id);
    if (!access || !['ADMINISTRATOR', 'FULL_ACCESS'].includes(access)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const subtreeIds = await collectSubtreeIds(req.params.id);

    await prisma.passwordEntry.deleteMany({
      where: { id: { in: subtreeIds } },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'DELETE_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: req.params.id,
        metadata: {
          name: password.name,
          folderId: password.folderId,
          vaultId: password.vaultId,
          vaultType: await getVaultType(password.vaultId),
          purged: true,
        },
      },
    });

    res.json({ message: 'Password permanently deleted' });
  } catch (error) {
    console.error('Purge password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getTrash = async (req, res) => {
  try {
    const { vaultId } = req.params;

    const access = await getVaultAccess(vaultId, req.user.id);
    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const vaultType = await getVaultType(vaultId);
    if (!vaultType || vaultType === 'PERSONAL') {
      return res.json([]);
    }

    const trash = await prisma.passwordEntry.findMany({
      where: {
        vaultId,
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
    console.error('Get trash error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const logCopyPassword = async (req, res) => {
  try {
    const password = await prisma.passwordEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (password.deletedAt) {
      return res.status(404).json({ message: 'Password not found' });
    }

    const hasFolderAccess = await getFolderAccess(password.folderId, req.user.id);
    const hasShare = await prisma.passwordShare.findFirst({
      where: {
        passwordId: password.id,
        sharedWithId: req.user.id,
      },
    });

    const hasAccessViaFolder = hasFolderAccess && ['ADMINISTRATOR', 'READ_WRITE', 'READ_ONLY', 'FULL_ACCESS'].includes(hasFolderAccess);

    if (!hasAccessViaFolder && !hasShare) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const vaultType = await getVaultType(password.vaultId);

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'COPY_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: password.id,
        metadata: {
          name: password.name,
          folderId: password.folderId,
          vaultId: password.vaultId,
          vaultType,
        },
      },
    });

    res.json({ message: 'Password copy activity logged' });
  } catch (error) {
    console.error('Log copy password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const logViewPassword = async (req, res) => {
  try {
    const password = await prisma.passwordEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    if (password.deletedAt) {
      return res.status(404).json({ message: 'Password not found' });
    }

    const hasFolderAccess = await getFolderAccess(password.folderId, req.user.id);
    const hasShare = await prisma.passwordShare.findFirst({
      where: {
        passwordId: password.id,
        sharedWithId: req.user.id,
      },
    });

    const hasAccessViaFolder = hasFolderAccess && ['ADMINISTRATOR', 'READ_WRITE', 'READ_ONLY', 'FULL_ACCESS'].includes(hasFolderAccess);

    if (!hasAccessViaFolder && !hasShare) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prisma.passwordEntry.update({
      where: { id: password.id },
      data: {
        lastViewedAt: new Date(),
      },
    });

    const vaultType = await getVaultType(password.vaultId);

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'VIEW_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: password.id,
        metadata: {
          name: password.name,
          folderId: password.folderId,
          vaultId: password.vaultId,
          vaultType,
        },
      },
    });

    res.json({ message: 'Password view activity logged' });
  } catch (error) {
    console.error('Log view password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPasswordsOwnedByUser = async (req, res) => {
  try {
    const passwords = await prisma.passwordEntry.findMany({
      where: { createdById: req.user.id },
      select: {
        id: true,
        encryptedPassword: true,
        encryptedNote: true,
      },
    });

    res.json(passwords);
  } catch (error) {
    console.error('Get passwords owned by user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getItemsNeedingWrapping = async (req, res) => {
  try {
    const { vaultId } = req.params;
    const userId = req.user.id;

    const vault = await prisma.vault.findUnique({
      where: { id: vaultId },
      select: { type: true },
    });

    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    if (vault.type === 'PERSONAL') {
      return res.status(400).json({ message: 'Personal vaults do not support key wrapping' });
    }

    const access = await getVaultAccess(vaultId, userId);
    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const passwords = await prisma.passwordEntry.findMany({
      where: { vaultId },
      select: {
        id: true,
        name: true,
        folderId: true,
        wrappedKeys: true,
      },
    });

    const recipientsCache = {};
    const result = [];

    for (const pw of passwords) {
      const allWrappedKeys = pw.wrappedKeys || {};
      const myWrappedKey = allWrappedKeys[userId];

      // Only report items the caller can actually unwrap (they are the
      // ones who can re-wrap for missing recipients).
      if (!myWrappedKey) continue;

      if (pw.folderId && !recipientsCache[pw.folderId]) {
        recipientsCache[pw.folderId] = await getFolderAuthorizedUserIds(pw.folderId);
      }

      const recipientIds = pw.folderId ? recipientsCache[pw.folderId] : [];
      const missingUserIds = recipientIds.filter((uid) => !allWrappedKeys[uid]);

      if (missingUserIds.length > 0) {
        result.push({
          id: pw.id,
          name: pw.name,
          folderId: pw.folderId,
          missingUserIds,
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Get items needing wrapping error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const batchWrapKeys = async (req, res) => {
  try {
    const { wrappedFolders, wrappedPasswords } = req.body;

    if (!wrappedFolders && !wrappedPasswords) {
      return res.status(400).json({ message: 'wrappedFolders or wrappedPasswords is required' });
    }

    const canWriteFolder = async (folderId) => {
      const access = await getFolderAccess(folderId, req.user.id);
      return (
        !!access &&
        ['ADMINISTRATOR', 'READ_WRITE', 'FULL_ACCESS'].includes(access)
      );
    };

    let count = 0;

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(wrappedFolders)) {
        for (const item of wrappedFolders) {
          if (!item.folderId || !item.wrappedKeys) continue;

          // Object-level authorization: only authorized writers may mutate
          // a folder's key material.
          if (!(await canWriteFolder(item.folderId))) {
            throw new Error('ACCESS_DENIED');
          }

          // Keys may only be stored for recipients currently authorized in the folder.
          if (!(await validateWrappedKeys(item.folderId, item.wrappedKeys))) {
            throw new Error('INVALID_WRAPPED_KEYS');
          }

          const existing = await tx.folder.findUnique({
            where: { id: item.folderId },
            select: { wrappedKeys: true },
          });

          // Merge so we never wipe other users' wrapped keys.
          const mergedWrappedKeys = {
            ...(existing?.wrappedKeys || {}),
            ...item.wrappedKeys,
          };

          await tx.folder.update({
            where: { id: item.folderId },
            data: { wrappedKeys: mergedWrappedKeys },
          });
          count += 1;
        }
      }

      if (Array.isArray(wrappedPasswords)) {
        for (const item of wrappedPasswords) {
          const passwordId = item.id || item.passwordId;
          if (!passwordId) continue;

          const hasKeyAdditions =
            item.wrappedKeys && Object.keys(item.wrappedKeys).length > 0;
          if (!hasKeyAdditions && !item.encryptedPassword && item.encryptedNote === undefined) {
            continue;
          }

          // Object-level authorization: only authorized writers may mutate
          // a password entry's ciphertext / key material.
          const pw = await tx.passwordEntry.findUnique({
            where: { id: passwordId },
            select: { folderId: true },
          });
          if (!pw || !pw.folderId || !(await canWriteFolder(pw.folderId))) {
            throw new Error('ACCESS_DENIED');
          }

          // If wrapped keys are supplied, they may only target recipients
          // authorized in the password's folder.
          if (item.wrappedKeys && Object.keys(item.wrappedKeys).length > 0) {
            if (!(await validateWrappedKeys(pw.folderId, item.wrappedKeys))) {
              throw new Error('INVALID_WRAPPED_KEYS');
            }
          }

          const existing = await tx.passwordEntry.findUnique({
            where: { id: passwordId },
            select: { wrappedKeys: true },
          });

          // Merge so we never wipe other users' wrapped keys.
          const mergedWrappedKeys = {
            ...(existing?.wrappedKeys || {}),
            ...(item.wrappedKeys || {}),
          };

          await tx.passwordEntry.update({
            where: { id: passwordId },
            data: {
              wrappedKeys: mergedWrappedKeys,
              ...(item.encryptedPassword && { encryptedPassword: item.encryptedPassword }),
              ...(item.encryptedNote !== undefined && { encryptedNote: item.encryptedNote }),
            },
          });
          count += 1;
        }
      }
    });

    res.json({ message: 'Keys wrapped successfully', count });
  } catch (error) {
    console.error('Batch wrap keys error:', error);
    if (error.message === 'ACCESS_DENIED') {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (error.message === 'INVALID_WRAPPED_KEYS') {
      return res.status(400).json({ message: 'Wrapped keys contain unauthorized recipients' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPassword,
  getPasswordsByVault,
  getPasswordById,
  updatePassword,
  deletePassword,
  restorePassword,
  purgePassword,
  getTrash,
  logCopyPassword,
  logViewPassword,
  importPasswordsFromExcel,
  getPasswordsOwnedByUser,
  getItemsNeedingWrapping,
  batchWrapKeys,
};