const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const {
  getEffectiveOrganizationPolicy,
  invalidatePolicyCache,
  DEFAULT_POLICY,
} = require('../utils/organizationPolicy');

const getOrganizationPolicy = async (req, res) => {
  try {
    const policy = await getEffectiveOrganizationPolicy();
    res.json({ policy });
  } catch (error) {
    console.error('Get organization policy error:', error);
    res.status(500).json({ message: 'Server error retrieving policy' });
  }
};

const updateOrganizationPolicy = async (req, res) => {
  try {
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: Only Admins and Owners can manage organization policies' });
    }

    const {
      requireTwoFactor,
      maxVaultTimeoutMinutes,
      minMasterPasswordLength,
      requireMasterPasswordSpecial,
      clipboardTimeoutSeconds,
      requireDualAdminApproval,
    } = req.body;

    const data = {};

    if (requireDualAdminApproval !== undefined) {
      data.requireDualAdminApproval = Boolean(requireDualAdminApproval);
    }

    if (requireTwoFactor !== undefined) {
      data.requireTwoFactor = Boolean(requireTwoFactor);
    }

    if (maxVaultTimeoutMinutes !== undefined) {
      if (maxVaultTimeoutMinutes === null || maxVaultTimeoutMinutes === '') {
        data.maxVaultTimeoutMinutes = null;
      } else {
        const val = Number(maxVaultTimeoutMinutes);
        if (!Number.isInteger(val) || val < 1 || val > 1440) {
          return res.status(400).json({ message: 'maxVaultTimeoutMinutes must be between 1 and 1440 minutes (24 hours)' });
        }
        data.maxVaultTimeoutMinutes = val;
      }
    }

    if (minMasterPasswordLength !== undefined) {
      const val = Number(minMasterPasswordLength);
      if (!Number.isInteger(val) || val < 8 || val > 32) {
        return res.status(400).json({ message: 'minMasterPasswordLength must be between 8 and 32 characters' });
      }
      data.minMasterPasswordLength = val;
    }

    if (requireMasterPasswordSpecial !== undefined) {
      data.requireMasterPasswordSpecial = Boolean(requireMasterPasswordSpecial);
    }

    if (clipboardTimeoutSeconds !== undefined) {
      if (clipboardTimeoutSeconds === null || clipboardTimeoutSeconds === '') {
        data.clipboardTimeoutSeconds = null;
      } else {
        const val = Number(clipboardTimeoutSeconds);
        if (!Number.isInteger(val) || val < 5 || val > 600) {
          return res.status(400).json({ message: 'clipboardTimeoutSeconds must be between 5 and 600 seconds' });
        }
        data.clipboardTimeoutSeconds = val;
      }
    }

    data.updatedById = req.user.id;

    const policy = await prisma.organizationPolicy.upsert({
      where: { id: 'default' },
      update: data,
      create: {
        id: 'default',
        ...DEFAULT_POLICY,
        ...data,
      },
    });

    invalidatePolicyCache();

    // Log administrative policy update
    await prisma.activityLog.create({
      data: {
        id: await generateId('activity'),
        userId: req.user.id,
        action: 'UPDATE_ORGANIZATION_POLICY',
        targetType: 'POLICY',
        targetId: 'default',
        metadata: {
          updatedBy: req.user.email,
          changes: data,
        },
      },
    });

    res.json({
      message: 'Organization security policy updated successfully',
      policy,
    });
  } catch (error) {
    console.error('Update organization policy error:', error);
    res.status(500).json({ message: 'Server error updating policy' });
  }
};

module.exports = {
  getOrganizationPolicy,
  updateOrganizationPolicy,
};
