const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const createNotification = require('../utils/createNotification');

const sharePassword = async (req, res) => {
  try {
    const { passwordId } = req.params;
    const { userId, encryptedItemKey, reEncryptedPassword, reEncryptedNote, reEncryptedFields } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User is required' });
    }

    const password = await prisma.passwordEntry.findUnique({
      where: { id: passwordId },
      include: {
        vault: true,
        folder: true,
      },
    });

    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }

    const isOwner =
      password.createdById === req.user.id ||
      password.vault.ownerId === req.user.id;

    if (!isOwner) {
      return res.status(403).json({
        message: 'Only owner can share this password',
      });
    }

    const sharedUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!sharedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (sharedUser.id === req.user.id) {
      return res.status(400).json({
        message: 'You cannot share password with yourself',
      });
    }

    const share = await prisma.passwordShare.upsert({
      where: {
        passwordId_sharedWithId: {
          passwordId,
          sharedWithId: sharedUser.id,
        },
      },
      update: {
        ...(encryptedItemKey && { encryptedItemKey }),
        ...(reEncryptedPassword !== undefined && { reEncryptedPassword: reEncryptedPassword || null }),
        ...(reEncryptedNote !== undefined && { reEncryptedNote: reEncryptedNote || null }),
        ...(reEncryptedFields !== undefined && { reEncryptedFields: reEncryptedFields || null }),
      },
      create: {
        id: await generateId('passwordShare'),
        passwordId,
        sharedWithId: sharedUser.id,
        sharedById: req.user.id,
        encryptedItemKey: encryptedItemKey || null,
        reEncryptedPassword: reEncryptedPassword || null,
        reEncryptedNote: reEncryptedNote || null,
        reEncryptedFields: reEncryptedFields || null,
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        sharedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        password: {
          select: {
            id: true,
            name: true,
            type: true,
            login: true,
            url: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'SHARE_PASSWORD',
        targetType: 'PasswordEntry',
        targetId: passwordId,
        metadata: {
          passwordId,
          sharedWithId: sharedUser.id,
          sharedWithName: sharedUser.fullName,
          folderId: password.folderId,
          vaultId: password.vaultId,
        },
      },
    });

    await createNotification({
      userId: sharedUser.id,
      title: 'Password Shared',
      message: `${req.user.email} shared "${password.name}" with you`,
      type: 'SHARE_PASSWORD',
      metadata: {
        passwordId,
        shareId: share.id,
        vaultId: password.vaultId,
        folderId: password.folderId,
      },
    });

    res.status(201).json(share);
  } catch (error) {
    console.error('Share password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSharedWithMe = async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { encryptionSalt: true },
    });

    const keyPair = await prisma.userKeyPair.findUnique({
      where: { userId: req.user.id },
      select: { encryptedPrivateKey: true, publicKey: true, salt: true },
    });

    const sharedPasswords = await prisma.passwordShare.findMany({
      where: {
        sharedWithId: req.user.id,
      },
      include: {
        password: {
          include: {
            folder: true,
            vault: {
              select: {
                id: true,
                name: true,
                type: true,
                owner: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    // Needed by legacy shares that were never re-encrypted
                    // for the recipient's key pair.
                    encryptionSalt: true,
                  },
                },
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
        sharedBy: {
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

    res.json({
      sharedPasswords,
      userEncryptionSalt: currentUser?.encryptionSalt,
      userKeyPair: keyPair,
    });
  } catch (error) {
    console.error('Get shared with me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const removePasswordShare = async (req, res) => {
  try {
    const { shareId } = req.params;

    const share = await prisma.passwordShare.findUnique({
      where: { id: shareId },
      include: {
        sharedWith: true,
        password: {
          include: {
            vault: true,
          },
        },
      },
    });

    if (!share) {
      return res.status(404).json({ message: 'Share not found' });
    }

    const canRemove =
      share.sharedById === req.user.id ||
      share.password.createdById === req.user.id ||
      share.password.vault.ownerId === req.user.id;

    if (!canRemove) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prisma.passwordShare.delete({
      where: { id: shareId },
    });

    await createNotification({
      userId: share.sharedWithId,
      title: 'Password Access Removed',
      message: `Your access to "${share.password.name}" was removed`,
      type: 'SHARE_PASSWORD',
      metadata: {
        passwordId: share.passwordId,
        shareId,
        vaultId: share.password.vaultId,
        folderId: share.password.folderId,
      },
    });

    res.json({ message: 'Password share removed successfully' });
  } catch (error) {
    console.error('Remove password share error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  sharePassword,
  getSharedWithMe,
  removePasswordShare,
};