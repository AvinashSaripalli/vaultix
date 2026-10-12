const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');

const requireAdmin = (req, res) => {
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ message: 'Access denied' });
    return true;
  }

  return false;
};

const getShareableUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        id: {
          not: req.user.id,
        },
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Get shareable users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUsers = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const VALID_ROLES = ['ADMIN', 'USER'];
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=<>?/{}[\]|~`])/;

const createUserByAdmin = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const { fullName, email, password, role = 'USER' } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: 'fullName, email and password are required',
      });
    }

    if (fullName.trim().length < 2) {
      return res.status(400).json({ message: 'fullName must be at least 2 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        message: 'Password must include uppercase, lowercase, number, and special character',
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'Email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const encryptionSalt = crypto.randomBytes(16).toString('hex');
    const userId = await generateId('user');

    const user = await prisma.user.create({
      data: {
        id: userId,
        fullName,
        email,
        passwordHash,
        encryptionSalt,
        role,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user by admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const { fullName, role, isActive } = req.body;

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    if (fullName !== undefined && fullName.trim().length < 2) {
      return res.status(400).json({ message: 'fullName must be at least 2 characters' });
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: req.params.id,
      },
      data: {
        fullName,
        role,
        isActive,
        ...(isActive === false && { tokenVersion: { increment: 1 } }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (isActive === false) {
      await prisma.refreshToken.updateMany({
        where: { userId: req.params.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const userId = req.params.id;

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    await prisma.$transaction(async (tx) => {
      const createdPasswords = await tx.passwordEntry.findMany({
        where: { createdById: userId },
        select: {
          id: true,
          vault: { select: { ownerId: true } },
        },
      });

      const toReassign = [];
      const ownVaultPasswordIds = [];

      for (const entry of createdPasswords) {
        if (entry.vault.ownerId === userId) {
          ownVaultPasswordIds.push(entry.id);
        } else {
          toReassign.push(entry);
        }
      }

      for (const entry of toReassign) {
        await tx.passwordEntry.update({
          where: { id: entry.id },
          data: { createdById: entry.vault.ownerId },
        });
      }

      if (ownVaultPasswordIds.length > 0) {
        await tx.passwordEntry.deleteMany({
          where: { id: { in: ownVaultPasswordIds } },
        });
      }

      await tx.user.delete({
        where: { id: userId },
      });
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getShareableUsers,
  getUsers,
  createUserByAdmin,
  updateUser,
  deleteUser,
};