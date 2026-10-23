const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const { getEffectiveOrganizationPolicy } = require('../utils/organizationPolicy');
const { getDepartmentIdsWithAncestors } = require('../utils/permissions');

const isSuperAdminRole = (role) => role === 'SUPER_ADMIN';
const isAdminRole = (role) => ['SUPER_ADMIN', 'ADMIN'].includes(role);

const requireAdmin = (req, res) => {
  if (!isAdminRole(req.user.role)) {
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

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'USER'];
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=<>?/{}[\]|~`])/;

const createUserByAdmin = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const { fullName, email, password, role = 'USER' } = req.body;
    const targetRole = role;

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

    if (!VALID_ROLES.includes(targetRole)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: SUPER_ADMIN, ADMIN, USER` });
    }

    // Only a Super Admin can create another Super Admin
    if (isSuperAdminRole(targetRole) && !isSuperAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Only a Super Admin can designate another Super Admin' });
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
        role: targetRole,
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

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'CREATE_USER',
        targetType: 'User',
        targetId: user.id,
        metadata: {
          name: user.fullName,
          email: user.email,
          role: user.role,
        },
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

    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true, isActive: true },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetRole = role;

    // Security Guardrail 1: Only a Super Admin can modify a Super Admin
    if (isSuperAdminRole(targetUser.role) && !isSuperAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Only a Super Admin can modify a Super Admin account' });
    }

    // Security Guardrail 2: Only a Super Admin can grant the Super Admin role
    if (isSuperAdminRole(targetRole) && !isSuperAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Only a Super Admin can grant Super Admin privileges' });
    }

    // Security Guardrail 3: Last Admin / Super Admin Protection
    // Prevent demoting or deactivating the last active administrator
    if (
      isAdminRole(targetUser.role) &&
      (targetRole === 'USER' || isActive === false)
    ) {
      const remainingAdmins = await prisma.user.count({
        where: {
          role: { in: ['SUPER_ADMIN', 'ADMIN'] },
          isActive: true,
          id: { not: targetUser.id },
        },
      });

      if (remainingAdmins === 0) {
        return res.status(400).json({
          message: 'Cannot demote or deactivate the last remaining administrator. Please promote another administrator first.',
        });
      }
    }

    // Security Guardrail 4: Last Super Admin Protection
    // Prevent demoting the last active Super Admin
    if (isSuperAdminRole(targetUser.role) && targetRole && !isSuperAdminRole(targetRole)) {
      const remainingSuperAdmins = await prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isActive: true,
          id: { not: targetUser.id },
        },
      });

      if (remainingSuperAdmins === 0) {
        return res.status(400).json({
          message: 'Cannot demote the last remaining Super Admin. Please designate another Super Admin first.',
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: req.params.id,
      },
      data: {
        fullName,
        ...(targetRole && { role: targetRole }),
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

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'UPDATE_USER',
        targetType: 'User',
        targetId: updatedUser.id,
        metadata: {
          name: updatedUser.fullName,
          email: updatedUser.email,
          oldRole: targetUser.role,
          newRole: updatedUser.role,
          isActive: updatedUser.isActive,
        },
      },
    });

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

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, fullName: true, email: true },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Security Guardrail 1: Only a Super Admin can delete a Super Admin account
    if (isSuperAdminRole(targetUser.role) && !isSuperAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Only a Super Admin can delete a Super Admin account' });
    }

    // Security Guardrail 2: Last Admin Protection
    if (isAdminRole(targetUser.role)) {
      const remainingAdmins = await prisma.user.count({
        where: {
          role: { in: ['SUPER_ADMIN', 'ADMIN'] },
          isActive: true,
          id: { not: targetUser.id },
        },
      });

      if (remainingAdmins === 0) {
        return res.status(400).json({
          message: 'Cannot delete the last remaining administrator.',
        });
      }
    }

    // Security Guardrail 3: Last Super Admin Protection
    if (isSuperAdminRole(targetUser.role)) {
      const remainingSuperAdmins = await prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isActive: true,
          id: { not: targetUser.id },
        },
      });

      if (remainingSuperAdmins === 0) {
        return res.status(400).json({
          message: 'Cannot delete the last remaining Super Admin. Please designate another Super Admin first.',
        });
      }
    }

    // Security Guardrail 4: Strict Super Admin Approval Policy
    const policy = await getEffectiveOrganizationPolicy();

    // Case A: An ADMIN is attempting to delete another ADMIN -> Requires Super Admin approval
    if (targetUser.role === 'ADMIN' && req.user.role === 'ADMIN' && policy?.requireDualAdminApproval) {
      const approvalId = await generateId('req');
      const targetName = targetUser.fullName || targetUser.email;

      const approvalRequest = await prisma.adminApprovalRequest.create({
        data: {
          id: approvalId,
          actionType: 'DELETE_ADMIN',
          title: `Delete Administrator: ${targetName}`,
          description: `Administrator ${req.user.fullName || req.user.email} initiated removal of Administrator account (${targetUser.email}). Requires Super Admin approval.`,
          payload: {
            userId: targetUser.id,
            userEmail: targetUser.email,
            userRole: targetUser.role,
          },
          requesterId: req.user.id,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
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
            actionType: 'DELETE_ADMIN',
            targetUserId: targetUser.id,
            targetUserEmail: targetUser.email,
          },
        },
      });

      return res.status(202).json({
        approvalRequired: true,
        message: `Super Admin Approval Required: Deleting an Administrator requires authorization from a Super Admin. A pending approval request (#${approvalId}) has been submitted for Super Admin review.`,
        approvalRequest,
      });
    }

    // Case B: A Super Admin is deleting another Super Admin (if multiple exist) -> Requires Co-Super Admin confirmation
    if (isSuperAdminRole(targetUser.role) && isSuperAdminRole(req.user.role) && policy?.requireDualAdminApproval) {
      const otherSuperAdminsCount = await prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isActive: true,
          id: { not: req.user.id },
        },
      });

      if (otherSuperAdminsCount > 0) {
        const approvalId = await generateId('req');
        const targetName = targetUser.fullName || targetUser.email;

        const approvalRequest = await prisma.adminApprovalRequest.create({
          data: {
            id: approvalId,
            actionType: 'DELETE_ADMIN',
            title: `Delete Super Admin: ${targetName}`,
            description: `Super Admin ${req.user.fullName || req.user.email} initiated removal of Co-Super Admin account (${targetUser.email}). Requires Co-Super Admin confirmation.`,
            payload: {
              userId: targetUser.id,
              userEmail: targetUser.email,
              userRole: targetUser.role,
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
              actionType: 'DELETE_ADMIN',
              targetUserId: targetUser.id,
              targetUserEmail: targetUser.email,
            },
          },
        });

        return res.status(202).json({
          approvalRequired: true,
          message: `Co-Super Admin Approval Required: Deleting a Super Admin account requires authorization from a second Super Admin. A pending approval request (#${approvalId}) has been submitted for review.`,
          approvalRequest,
        });
      }
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

      await tx.activityLog.create({
        data: {
          id: await generateId('activityLog'),
          userId: req.user.id,
          action: 'DELETE_USER',
          targetType: 'User',
          targetId: userId,
          metadata: {
            name: targetUser.fullName,
            email: targetUser.email,
            role: targetUser.role,
          },
        },
      });
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserAccessSummary = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const isCallerAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

    // Allow Admins/SuperAdmins, or user viewing their own access
    if (!isCallerAdmin && req.user.id !== targetUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        departmentMemberships: {
          include: {
            department: {
              select: { id: true, name: true, parentId: true },
            },
          },
        },
      },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 1. Resolve User Departments & Ancestor Department IDs
    const directDepartmentIds = (targetUser.departmentMemberships || []).map((dm) => dm.departmentId);
    const allDepartmentIds = await getDepartmentIdsWithAncestors(directDepartmentIds);

    // Fetch department details for any inherited departments
    const allDepartments = await prisma.department.findMany({
      where: { id: { in: allDepartmentIds } },
      select: { id: true, name: true },
    });
    const deptNameMap = new Map(allDepartments.map((d) => [d.id, d.name]));

    const departmentsSummary = (targetUser.departmentMemberships || []).map((dm) => ({
      id: dm.departmentId,
      name: dm.department?.name || 'Department',
      role: dm.memberRole || 'MEMBER',
    }));

    // 2. Fetch all non-personal Vaults and their Folders
    const vaults = await prisma.vault.findMany({
      where: {
        type: { not: 'PERSONAL' },
      },
      include: {
        owner: {
          select: { id: true, fullName: true, email: true },
        },
        permissions: {
          where: { userId: targetUserId },
        },
        folders: {
          where: { deletedAt: null },
          include: {
            permissions: {
              where: { userId: targetUserId },
            },
            departmentPermissions: {
              where: { departmentId: { in: allDepartmentIds } },
              include: {
                department: { select: { id: true, name: true } },
              },
            },
            _count: {
              select: { passwords: { where: { deletedAt: null } } },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const isTargetAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(targetUser.role);

    const folderAccessList = [];

    const RANK = {
      READ_ONLY: 0,
      READ_WRITE: 1,
      FULL_ACCESS: 2,
      ADMINISTRATOR: 3,
    };

    for (const vault of vaults) {
      const isVaultOwner = vault.ownerId === targetUserId;

      for (const folder of vault.folders) {
        const directPerm = folder.permissions?.[0] || null;
        const deptGrants = folder.departmentPermissions || [];
        const blockedUsers = Array.isArray(folder.blockedUserIds) ? folder.blockedUserIds : [];
        const isBlocked = blockedUsers.includes(targetUserId);

        // Resolve Department Access Level
        let deptAccessLevel = null;
        let viaDepts = [];
        if (deptGrants.length > 0) {
          const hasForbiddenDept = deptGrants.some((g) => g.accessLevel === 'FORBIDDEN');
          if (hasForbiddenDept) {
            deptAccessLevel = 'FORBIDDEN';
          } else {
            const validGrants = deptGrants.filter(
              (g) => g.accessLevel && g.accessLevel !== 'FORBIDDEN' && g.accessLevel !== 'NOT_SET'
            );
            if (validGrants.length > 0) {
              validGrants.sort((a, b) => (RANK[b.accessLevel] ?? -1) - (RANK[a.accessLevel] ?? -1));
              deptAccessLevel = validGrants[0].accessLevel;
            }
          }
          viaDepts = deptGrants.map((g) => g.department?.name || deptNameMap.get(g.departmentId) || 'Department');
        }

        // Determine Effective Access and Source
        let effectiveAccess = null;
        let accessSource = 'NONE'; // 'ROLE_ADMIN' | 'VAULT_OWNER' | 'DIRECT' | 'DEPARTMENT' | 'BLOCKED' | 'NONE'

        if (isTargetAdmin) {
          effectiveAccess = 'ADMINISTRATOR';
          accessSource = 'ROLE_ADMIN';
        } else if (isVaultOwner) {
          effectiveAccess = 'ADMINISTRATOR';
          accessSource = 'VAULT_OWNER';
        } else if (directPerm) {
          if (directPerm.accessLevel === 'FORBIDDEN') {
            effectiveAccess = 'FORBIDDEN';
            accessSource = 'DIRECT_FORBIDDEN';
          } else {
            // Direct permission takes precedence or highest with department
            if (deptAccessLevel && deptAccessLevel !== 'FORBIDDEN') {
              effectiveAccess =
                (RANK[directPerm.accessLevel] ?? -1) >= (RANK[deptAccessLevel] ?? -1)
                  ? directPerm.accessLevel
                  : deptAccessLevel;
              accessSource = effectiveAccess === directPerm.accessLevel ? 'DIRECT' : 'DEPARTMENT';
            } else {
              effectiveAccess = directPerm.accessLevel;
              accessSource = 'DIRECT';
            }
          }
        } else if (isBlocked) {
          effectiveAccess = 'FORBIDDEN';
          accessSource = 'BLOCKED';
        } else if (deptAccessLevel) {
          if (deptAccessLevel === 'FORBIDDEN') {
            effectiveAccess = 'FORBIDDEN';
            accessSource = 'DEPARTMENT_FORBIDDEN';
          } else {
            effectiveAccess = deptAccessLevel;
            accessSource = 'DEPARTMENT';
          }
        } else {
          effectiveAccess = null;
          accessSource = 'NONE';
        }

        folderAccessList.push({
          folderId: folder.id,
          folderName: folder.name,
          vaultId: vault.id,
          vaultName: vault.name,
          vaultType: vault.type,
          itemCount: folder._count?.passwords || 0,
          effectiveAccess, // 'ADMINISTRATOR' | 'FULL_ACCESS' | 'READ_WRITE' | 'READ_ONLY' | 'FORBIDDEN' | null
          hasAccess: Boolean(effectiveAccess && effectiveAccess !== 'FORBIDDEN'),
          accessSource,
          directPermission: directPerm
            ? {
                id: directPerm.id,
                accessLevel: directPerm.accessLevel,
              }
            : null,
          deptAccessLevel,
          viaDepartments: viaDepts,
          isBlocked,
          isVaultOwner,
          isRoleAdmin: isTargetAdmin,
        });
      }
    }

    // Sort: Folders with access first, then by Vault name, then Folder name
    folderAccessList.sort((a, b) => {
      if (a.hasAccess !== b.hasAccess) return a.hasAccess ? -1 : 1;
      if (a.vaultName.localeCompare(b.vaultName) !== 0) return a.vaultName.localeCompare(b.vaultName);
      return a.folderName.localeCompare(b.folderName);
    });

    const summary = {
      user: {
        id: targetUser.id,
        fullName: targetUser.fullName,
        email: targetUser.email,
        role: targetUser.role,
        isActive: targetUser.isActive,
      },
      departments: departmentsSummary,
      stats: {
        totalFolders: folderAccessList.length,
        accessibleFolders: folderAccessList.filter((f) => f.hasAccess).length,
        directGrants: folderAccessList.filter((f) => f.directPermission && f.directPermission.accessLevel !== 'FORBIDDEN').length,
        deptGrants: folderAccessList.filter((f) => f.accessSource === 'DEPARTMENT').length,
        forbiddenOrBlocked: folderAccessList.filter((f) => f.effectiveAccess === 'FORBIDDEN').length,
      },
      folders: folderAccessList,
    };

    res.json(summary);
  } catch (error) {
    console.error('Get user access summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getShareableUsers,
  getUsers,
  createUserByAdmin,
  updateUser,
  deleteUser,
  getUserAccessSummary,
};