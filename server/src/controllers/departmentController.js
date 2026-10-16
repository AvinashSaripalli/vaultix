const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const createNotification = require('../utils/createNotification');
const { getVaultAccess, getFolderAccess } = require('../utils/permissions');

const ALLOWED_ACCESS_LEVELS = ['NOT_SET', 'FORBIDDEN', 'READ_ONLY', 'READ_WRITE', 'FULL_ACCESS', 'ADMINISTRATOR'];
const VALID_MEMBER_ROLES = ['MANAGER', 'MEMBER'];

const logActivity = async (userId, action, targetType, targetId, metadata) => {
  await prisma.activityLog.create({
    data: {
      id: await generateId('activityLog'),
      userId,
      action,
      targetType,
      targetId,
      metadata,
    },
  });
};

const requireAdmin = (req, res) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'OWNER'].includes(req.user.role)) {
    res.status(403).json({ message: 'Access denied' });
    return true;
  }
  return false;
};

const requireDeptManager = async (req, res) => {
  if (['SUPER_ADMIN', 'ADMIN', 'OWNER'].includes(req.user.role)) return { ok: true };

  const membership = await prisma.departmentMember.findUnique({
    where: {
      departmentId_userId: {
        departmentId: req.params.id,
        userId: req.user.id,
      },
    },
  });

  if (!membership || membership.memberRole !== 'MANAGER') {
    res.status(403).json({ message: 'Department manager access required' });
    return { ok: false };
  }

  return { ok: true };
};

const getDepartmentInclude = () => ({
  parent: { select: { id: true, name: true } },
  members: {
    include: {
      user: {
        select: { id: true, fullName: true, email: true, role: true, isActive: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  permissions: {
    include: {
      vault: { select: { id: true, name: true, slug: true, type: true } },
      folder: {
        select: { id: true, name: true, vault: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  _count: { select: { subDepartments: true } },
});

const getMyDepartments = async (req, res) => {
  try {
    const memberships = await prisma.departmentMember.findMany({
      where: { userId: req.user.id },
      include: {
        department: {
          include: {
            parent: { select: { id: true, name: true } },
            members: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, role: true, isActive: true },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            permissions: {
              include: {
                vault: { select: { id: true, name: true, slug: true, type: true } },
                folder: {
                  select: { id: true, name: true, vault: { select: { id: true, name: true } } },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            _count: { select: { subDepartments: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const departments = memberships.map((m) => ({
      ...m.department,
      myRole: m.memberRole,
      myMembershipId: m.id,
    }));

    res.json(departments);
  } catch (error) {
    console.error('Get my departments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getDepartments = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: getDepartmentInclude(),
      orderBy: { name: 'asc' },
    });

    // Attach myRole for current user if member, for display in MyDepartments view
    const userId = req.user?.id;
    if (userId) {
      const memberships = await prisma.departmentMember.findMany({
        where: { userId },
        select: { departmentId: true, memberRole: true },
      });
      const roleByDept = new Map(memberships.map((m) => [m.departmentId, m.memberRole]));
      for (const dept of departments) {
        if (roleByDept.has(dept.id)) {
          dept.myRole = roleByDept.get(dept.id);
        }
      }
    }

    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const validateParent = async (parentId, currentId = null) => {
  if (!parentId) return { ok: true };

  if (currentId && parentId === currentId) {
    return { ok: false, message: 'A department cannot be its own parent' };
  }

  const parent = await prisma.department.findUnique({ where: { id: parentId } });

  if (!parent) {
    return { ok: false, message: 'Parent department not found' };
  }

  if (currentId) {
    let ancestorId = parent.parentId;

    while (ancestorId) {
      if (ancestorId === currentId) {
        return { ok: false, message: 'Cannot move a department under one of its own sub-departments' };
      }
      const ancestor = await prisma.department.findUnique({
        where: { id: ancestorId },
        select: { parentId: true },
      });
      ancestorId = ancestor?.parentId || null;
    }
  }

  return { ok: true };
};

const createDepartment = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const { name, description, parentId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    const parentCheck = await validateParent(parentId);
    if (!parentCheck.ok) {
      return res.status(400).json({ message: parentCheck.message });
    }

    const existing = await prisma.department.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return res.status(400).json({ message: 'A department with this name already exists' });
    }

    const department = await prisma.department.create({
      data: {
        id: await generateId('department'),
        name: name.trim(),
        description: description?.trim() || null,
        parentId: parentId || null,
      },
      include: { parent: { select: { id: true, name: true } } },
    });

    await logActivity(req.user.id, 'CREATE_DEPARTMENT', 'Department', department.id, {
      name: department.name,
      parentId: department.parentId,
    });

    res.status(201).json(department);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const { name, description, parentId } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ message: 'Department name cannot be empty' });
    }

    if (name && name.trim() !== department.name) {
      const existing = await prisma.department.findUnique({
        where: { name: name.trim() },
      });

      if (existing) {
        return res.status(400).json({ message: 'A department with this name already exists' });
      }
    }

    if (parentId !== undefined && parentId !== department.parentId) {
      const parentCheck = await validateParent(parentId || null, department.id);
      if (!parentCheck.ok) {
        return res.status(400).json({ message: parentCheck.message });
      }
    }

    const updated = await prisma.department.update({
      where: { id: department.id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description.trim() || null : undefined,
        parentId: parentId !== undefined ? parentId || null : undefined,
      },
      include: { parent: { select: { id: true, name: true } } },
    });

    await logActivity(req.user.id, 'UPDATE_DEPARTMENT', 'Department', updated.id, {
      name: updated.name,
      parentId: updated.parentId,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { subDepartments: true, members: true } } },
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    if (department._count.subDepartments > 0) {
      return res.status(400).json({
        message:
          'This department has sub-departments. Delete or move them first before deleting it.',
      });
    }

    const memberUserIds = (
      await prisma.departmentMember.findMany({
        where: { departmentId: department.id },
        select: { userId: true },
      })
    ).map((m) => m.userId);

    await prisma.department.delete({
      where: { id: department.id },
    });

    await logActivity(req.user.id, 'DELETE_DEPARTMENT', 'Department', department.id, {
      name: department.name,
    });

    for (const uid of memberUserIds) {
      await createNotification({
        userId: uid,
        title: 'Department Deleted',
        message: `Department "${department.name}" has been deleted`,
        type: 'DEPARTMENT',
        metadata: { departmentId: department.id, departmentName: department.name },
      });
    }

    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const addMember = async (req, res) => {
  try {
    const access = await requireDeptManager(req, res);
    if (!access.ok) return;

    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const { userId, memberRole = 'MEMBER' } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    if (!VALID_MEMBER_ROLES.includes(memberRole)) {
      return res
        .status(400)
        .json({ message: `Invalid member role. Must be one of: ${VALID_MEMBER_ROLES.join(', ')}` });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingMembership = await prisma.departmentMember.findUnique({
      where: {
        departmentId_userId: {
          departmentId: department.id,
          userId,
        },
      },
    });

    if (existingMembership) {
      return res.status(400).json({ message: 'User is already a member of this department' });
    }

    const membership = await prisma.departmentMember.create({
      data: {
        id: await generateId('departmentMember'),
        departmentId: department.id,
        userId,
        memberRole,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true, isActive: true },
        },
      },
    });

    // If this department (or its ancestors) has folder/vault grants, unblock the newly added user
    try {
      const allDepts = await prisma.department.findMany({ select: { id: true, parentId: true } });
      const parentMap = new Map(allDepts.map((d) => [d.id, d.parentId]));
      const ancestorIds = new Set([department.id]);
      let cur = department.id;
      const guard = new Set();
      while (cur && !guard.has(cur)) {
        guard.add(cur);
        const parentId = parentMap.get(cur);
        if (parentId) {
          ancestorIds.add(parentId);
          cur = parentId;
        } else break;
      }
      const grants = await prisma.departmentPermission.findMany({
        where: { departmentId: { in: [...ancestorIds] } },
        select: { folderId: true, vaultId: true },
      });
      const folderIdsFromDirect = grants.filter((g) => g.folderId).map((g) => g.folderId);
      let folderIdsFromVault = [];
      const vaultIds = grants.filter((g) => g.vaultId).map((g) => g.vaultId);
      if (vaultIds.length) {
        const foldersInVaults = await prisma.folder.findMany({
          where: { vaultId: { in: vaultIds } },
          select: { id: true },
        });
        folderIdsFromVault = foldersInVaults.map((f) => f.id);
      }
      const allFolderIds = [...new Set([...folderIdsFromDirect, ...folderIdsFromVault])];
      for (const fid of allFolderIds) {
        const f = await prisma.folder.findUnique({ where: { id: fid }, select: { blockedUserIds: true } });
        const blocked = Array.isArray(f?.blockedUserIds) ? f.blockedUserIds : [];
        if (blocked.includes(userId)) {
          const filtered = blocked.filter((id) => id !== userId);
          await prisma.folder.update({
            where: { id: fid },
            data: { blockedUserIds: filtered.length ? filtered : null },
          });
        }
      }
    } catch (e) {
      console.error('Unblock after addMember error:', e);
    }

    await logActivity(req.user.id, 'ADD_DEPARTMENT_MEMBER', 'Department', department.id, {
      departmentName: department.name,
      userEmail: user.email,
      memberRole,
    });

    await createNotification({
      userId,
      title: 'Added to Department',
      message: `You have been added to "${department.name}" as ${memberRole}`,
      type: 'DEPARTMENT',
      metadata: { departmentId: department.id, departmentName: department.name, memberRole },
    });

    const existingMembers = await prisma.departmentMember.findMany({
      where: { departmentId: department.id, userId: { not: userId } },
      select: { userId: true },
    });

    for (const m of existingMembers) {
      await createNotification({
        userId: m.userId,
        title: 'New Department Member',
        message: `${user.fullName} joined "${department.name}"`,
        type: 'DEPARTMENT',
        metadata: { departmentId: department.id, departmentName: department.name },
      });
    }

    res.status(201).json(membership);
  } catch (error) {
    console.error('Add department member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateMember = async (req, res) => {
  try {
    const access = await requireDeptManager(req, res);
    if (!access.ok) return;

    const membership = await prisma.departmentMember.findUnique({
      where: {
        departmentId_userId: {
          departmentId: req.params.id,
          userId: req.params.userId,
        },
      },
    });

    if (!membership) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    const { memberRole } = req.body;

    if (!VALID_MEMBER_ROLES.includes(memberRole)) {
      return res
        .status(400)
        .json({ message: `Invalid member role. Must be one of: ${VALID_MEMBER_ROLES.join(', ')}` });
    }

    const updated = await prisma.departmentMember.update({
      where: { id: membership.id },
      data: { memberRole },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true, isActive: true },
        },
      },
    });

    await logActivity(
      req.user.id,
      'UPDATE_DEPARTMENT_MEMBER',
      'Department',
      req.params.id,
      {
        departmentId: req.params.id,
        userId: req.params.userId,
        memberRole,
      }
    );

    res.json(updated);
  } catch (error) {
    console.error('Update department member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const removeMember = async (req, res) => {
  try {
    const access = await requireDeptManager(req, res);
    if (!access.ok) return;

    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const membership = await prisma.departmentMember.findUnique({
      where: {
        departmentId_userId: {
          departmentId: department.id,
          userId: req.params.userId,
        },
      },
    });

    if (!membership) {
      return res.status(404).json({ message: 'User is not a member of this department' });
    }

    const removedUserId = req.params.userId;

    await prisma.departmentMember.delete({
      where: { id: membership.id },
    });

    await logActivity(req.user.id, 'REMOVE_DEPARTMENT_MEMBER', 'Department', department.id, {
      departmentName: department.name,
      userId: removedUserId,
    });

    await createNotification({
      userId: removedUserId,
      title: 'Removed from Department',
      message: `You have been removed from "${department.name}"`,
      type: 'DEPARTMENT',
      metadata: { departmentId: department.id, departmentName: department.name },
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove department member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createGrant = async (req, res) => {
  try {
    const access = await requireDeptManager(req, res);
    if (!access.ok) return;

    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

const { vaultId, folderId, accessLevel } = req.body;

    if (!vaultId && !folderId) {
      return res.status(400).json({ message: 'Either vaultId or folderId is required' });
    }

    if (vaultId && folderId) {
      return res.status(400).json({ message: 'Provide either vaultId or folderId, not both' });
    }

    const effectiveLevel = accessLevel || 'READ_ONLY';

    if (!ALLOWED_ACCESS_LEVELS.includes(effectiveLevel)) {
      return res.status(400).json({
        message: `Invalid access level. Must be one of: ${ALLOWED_ACCESS_LEVELS.join(', ')}`,
      });
    }

    let grantData;
    let metadataTarget;
    let targetName;

    if (folderId) {
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: { vault: { select: { id: true, type: true, name: true } } },
      });

      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      if (folder.vault.type === 'PERSONAL') {
        return res.status(400).json({ message: 'Personal vaults cannot be shared' });
      }

      const existingGrant = await prisma.departmentPermission.findFirst({
        where: { departmentId: department.id, folderId },
      });

      if (existingGrant) {
        return res
          .status(400)
          .json({ message: 'This department already has access to this folder' });
      }

      grantData = { folderId };
      metadataTarget = { folderId, folderName: folder.name, vaultName: folder.vault.name };
      targetName = `folder "${folder.name}"`;
    } else {
      const vault = await prisma.vault.findUnique({ where: { id: vaultId } });

      if (!vault) {
        return res.status(404).json({ message: 'Vault not found' });
      }

      if (vault.type === 'PERSONAL') {
        return res.status(400).json({ message: 'Personal vaults cannot be shared' });
      }

      const existingGrant = await prisma.departmentPermission.findFirst({
        where: { departmentId: department.id, vaultId },
      });

      if (existingGrant) {
        return res
          .status(400)
          .json({ message: 'This department already has access to this vault' });
      }

grantData = { vaultId };
      metadataTarget = { vaultId, vaultName: vault.name };
      targetName = `vault "${vault.name}"`;
    }

    // Only grant access the caller themselves holds at the administrator
    // level on the target — mirrors shareVault/shareFolder semantics. Without
    // this, any department manager could hand their whole department (and all
    // sub-departments) ADMINISTRATOR access to a vault/folder they have no
    // rights to, which is a cross-organization privilege escalation.
    const targetAccess = folderId
      ? await getFolderAccess(folderId, req.user.id)
      : await getVaultAccess(vaultId, req.user.id);

    if (targetAccess !== 'ADMINISTRATOR') {
      return res.status(403).json({
        message:
          'Administrator access on the target vault or folder is required to grant department access to it',
      });
    }

    const grant = await prisma.departmentPermission.create({
      data: {
id: await generateId('departmentPermission'),
        departmentId: department.id,
        accessLevel: effectiveLevel,
        ...grantData,
      },
      include: {
        vault: { select: { id: true, name: true, slug: true, type: true } },
        folder: {
          select: { id: true, name: true, vault: { select: { id: true, name: true } } },
        },
      },
    });

await logActivity(req.user.id, 'GRANT_DEPARTMENT_ACCESS', 'Department', department.id, {
      departmentName: department.name,
      ...metadataTarget,
      accessLevel: effectiveLevel,
    });

    const members = await prisma.departmentMember.findMany({
      where: { departmentId: department.id },
      select: { userId: true },
    });

    // Unblock department members from the folder/vault if they were previously blocked individually
    // This fixes the case where a user was removed via block and later re-granted via department
    try {
      if (folderId) {
        // For folder grants, also include members of descendant sub-departments
        const allDepts = await prisma.department.findMany({ select: { id: true, parentId: true } });
        const childrenMap = new Map();
        for (const d of allDepts) {
          if (!childrenMap.has(d.parentId)) childrenMap.set(d.parentId, []);
          childrenMap.get(d.parentId).push(d.id);
        }
        const expandedDeptIds = new Set([department.id]);
        const stack = [department.id];
        while (stack.length) {
          const cur = stack.pop();
          for (const child of childrenMap.get(cur) || []) {
            if (!expandedDeptIds.has(child)) {
              expandedDeptIds.add(child);
              stack.push(child);
            }
          }
        }
        const expandedMembers = await prisma.departmentMember.findMany({
          where: { departmentId: { in: [...expandedDeptIds] } },
          select: { userId: true },
        });
        const memberIds = [...new Set(expandedMembers.map((m) => m.userId))];
        if (memberIds.length) {
          const f = await prisma.folder.findUnique({ where: { id: folderId }, select: { blockedUserIds: true } });
          const blocked = Array.isArray(f?.blockedUserIds) ? f.blockedUserIds : [];
          const filtered = blocked.filter((id) => !memberIds.includes(id));
          if (filtered.length !== blocked.length) {
            await prisma.folder.update({
              where: { id: folderId },
              data: { blockedUserIds: filtered.length ? filtered : null },
            });
          }
        }
      } else if (vaultId) {
        const allDepts = await prisma.department.findMany({ select: { id: true, parentId: true } });
        const childrenMap = new Map();
        for (const d of allDepts) {
          if (!childrenMap.has(d.parentId)) childrenMap.set(d.parentId, []);
          childrenMap.get(d.parentId).push(d.id);
        }
        const expandedDeptIds = new Set([department.id]);
        const stack = [department.id];
        while (stack.length) {
          const cur = stack.pop();
          for (const child of childrenMap.get(cur) || []) {
            if (!expandedDeptIds.has(child)) {
              expandedDeptIds.add(child);
              stack.push(child);
            }
          }
        }
        const expandedMembers = await prisma.departmentMember.findMany({
          where: { departmentId: { in: [...expandedDeptIds] } },
          select: { userId: true },
        });
        const memberIds = [...new Set(expandedMembers.map((m) => m.userId))];
        if (memberIds.length) {
          const foldersInVault = await prisma.folder.findMany({
            where: { vaultId },
            select: { id: true, blockedUserIds: true },
          });
          for (const fld of foldersInVault) {
            const blocked = Array.isArray(fld.blockedUserIds) ? fld.blockedUserIds : [];
            const filtered = blocked.filter((id) => !memberIds.includes(id));
            if (filtered.length !== blocked.length) {
              await prisma.folder.update({
                where: { id: fld.id },
                data: { blockedUserIds: filtered.length ? filtered : null },
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Unblock after grant error:', e);
    }

    for (const m of members) {
  await createNotification({
        userId: m.userId,
        title: 'Department Access Granted',
        message: `Your department "${department.name}" received ${effectiveLevel} access to ${targetName}`,
        type: 'DEPARTMENT',
        metadata: { departmentId: department.id, departmentName: department.name, accessLevel: effectiveLevel },
      });
    }

    res.status(201).json(grant);
  } catch (error) {
    console.error('Create department grant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteGrant = async (req, res) => {
  try {
    const access = await requireDeptManager(req, res);
    if (!access.ok) return;

    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const grant = await prisma.departmentPermission.findFirst({
      where: { id: req.params.grantId, departmentId: department.id },
    });

    if (!grant) {
      return res.status(404).json({ message: 'Grant not found' });
    }

    const vaultName = grant.vaultId
      ? (await prisma.vault.findUnique({ where: { id: grant.vaultId }, select: { name: true } }))?.name
      : null;
    const folderName = grant.folderId
      ? (await prisma.folder.findUnique({ where: { id: grant.folderId }, select: { name: true } }))?.name
      : null;
    const targetName = folderName ? `folder "${folderName}"` : `vault "${vaultName}"`;

    await prisma.departmentPermission.delete({
      where: { id: grant.id },
    });

    await logActivity(req.user.id, 'REVOKE_DEPARTMENT_ACCESS', 'Department', department.id, {
      departmentName: department.name,
      grantId: grant.id,
      vaultId: grant.vaultId,
      folderId: grant.folderId,
    });

    const members = await prisma.departmentMember.findMany({
      where: { departmentId: department.id },
      select: { userId: true },
    });

    for (const m of members) {
      await createNotification({
        userId: m.userId,
        title: 'Department Access Revoked',
        message: `Your department "${department.name}" lost access to ${targetName}`,
        type: 'DEPARTMENT',
        metadata: { departmentId: department.id, departmentName: department.name },
      });
    }

    res.json({ message: 'Grant revoked successfully' });
  } catch (error) {
    console.error('Delete department grant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getMyDepartments,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addMember,
  updateMember,
  removeMember,
  createGrant,
  deleteGrant,
};
