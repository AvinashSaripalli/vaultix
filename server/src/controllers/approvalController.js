const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const { getEffectiveOrganizationPolicy } = require('../utils/organizationPolicy');

const requireAdmin = (req, res) => {
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    res.status(403).json({ message: 'Access denied: Administrator privileges required' });
    return true;
  }
  return false;
};

// Auto-expire requests that are still PENDING but passed their expiration date
const expireStaleRequests = async () => {
  try {
    await prisma.adminApprovalRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  } catch (error) {
    console.error('Error auto-expiring approval requests:', error);
  }
};

/**
 * GET /api/v1/admin-approvals/pending-count
 * Returns count of actionable pending requests for the current admin (excluding self-created)
 */
const getPendingCount = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    await expireStaleRequests();

    // Strict Owner-Only Policy: Only OWNER accounts have authority to approve requests
    if (req.user.role !== 'OWNER') {
      return res.json({ count: 0 });
    }

    const count = await prisma.adminApprovalRequest.count({
      where: {
        status: 'PENDING',
        requesterId: { not: req.user.id },
        expiresAt: { gt: new Date() },
      },
    });

    res.json({ count });
  } catch (error) {
    console.error('Get pending approval count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/v1/admin-approvals
 * Lists approval requests with filtering by tab ('actionable', 'my-requests', 'history')
 */
const getApprovalRequests = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    await expireStaleRequests();

    const { tab = 'actionable' } = req.query;
    let where = {};

    if (tab === 'actionable') {
      // Strict Owner-Only Policy: Only OWNER accounts have actionable requests awaiting approval
      if (req.user.role !== 'OWNER') {
        return res.json([]);
      }
      where = {
        status: 'PENDING',
        requesterId: { not: req.user.id },
        expiresAt: { gt: new Date() },
      };
    } else if (tab === 'my-requests') {
      where = {
        requesterId: req.user.id,
      };
    } else if (tab === 'pending') {
      where = {
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      };
    } else {
      // history or all
      where = {};
    }

    const requests = await prisma.adminApprovalRequest.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(requests);
  } catch (error) {
    console.error('Get approval requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/v1/admin-approvals
 * Explicitly create an approval request for a critical action
 */
const createApprovalRequest = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const { actionType, title, description, payload } = req.body;

    if (!actionType || !title || !payload) {
      return res.status(400).json({ message: 'actionType, title, and payload are required' });
    }

    const validActionTypes = ['DELETE_ADMIN', 'DELETE_FOLDER', 'PURGE_TRASH', 'EXPORT_AUDIT'];
    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({ message: `Invalid actionType. Must be one of: ${validActionTypes.join(', ')}` });
    }

    const id = await generateId('req');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const request = await prisma.adminApprovalRequest.create({
      data: {
        id,
        actionType,
        title,
        description: description || null,
        payload,
        requesterId: req.user.id,
        status: 'PENDING',
        expiresAt,
      },
      include: {
        requester: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activity'),
        userId: req.user.id,
        action: 'CREATE_APPROVAL_REQUEST',
        targetType: 'APPROVAL_REQUEST',
        targetId: id,
        metadata: { actionType, title, requesterEmail: req.user.email },
      },
    });

    res.status(201).json({
      message: 'Approval request submitted successfully. A second administrator must approve this action.',
      request,
    });
  } catch (error) {
    console.error('Create approval request error:', error);
    res.status(500).json({ message: 'Server error creating approval request' });
  }
};

/**
 * POST /api/v1/admin-approvals/:id/approve
 * Approves and immediately executes the high-stakes action
 */
const approveRequest = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const { id } = req.params;
    const { note } = req.body;

    const request = await prisma.adminApprovalRequest.findUnique({
      where: { id },
      include: { requester: true },
    });

    if (!request) {
      return res.status(404).json({ message: 'Approval request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: `Request is already ${request.status.toLowerCase()}` });
    }

    if (new Date(request.expiresAt) <= new Date()) {
      await prisma.adminApprovalRequest.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      return res.status(400).json({ message: 'This approval request has expired' });
    }

    // Strict Owner-Only Policy: Only an Organization Owner can approve requests
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({
        message: 'Strict Owner-Only Policy: Only an Organization Owner has authority to approve high-stakes actions.',
      });
    }

    // Four-Eyes Principle Invariant: The requester cannot approve their own request!
    if (request.requesterId === req.user.id) {
      return res.status(403).json({
        message: 'Security Violation: You cannot approve a request that you initiated yourself. Another Owner must approve it.',
      });
    }

    // Execute the action payload
    const payload = request.payload || {};
    let executionResult = { success: true };

    if (request.actionType === 'DELETE_ADMIN') {
      const targetUserId = payload.userId;
      if (!targetUserId) {
        return res.status(400).json({ message: 'Invalid payload: missing userId' });
      }

      await prisma.$transaction(async (tx) => {
        const createdPasswords = await tx.passwordEntry.findMany({
          where: { createdById: targetUserId },
          select: { id: true, vault: { select: { ownerId: true } } },
        });

        const toReassign = [];
        const ownVaultPasswordIds = [];

        for (const entry of createdPasswords) {
          if (entry.vault.ownerId === targetUserId) {
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
          where: { id: targetUserId },
        });
      });
    } else if (request.actionType === 'DELETE_FOLDER') {
      const targetFolderId = payload.folderId;
      if (!targetFolderId) {
        return res.status(400).json({ message: 'Invalid payload: missing folderId' });
      }

      await prisma.$transaction([
        prisma.folderPermission.deleteMany({ where: { folderId: targetFolderId } }),
        prisma.folder.delete({ where: { id: targetFolderId } }),
      ]);
    } else if (request.actionType === 'PURGE_TRASH') {
      const targetVaultId = payload.vaultId;
      const targetPasswordId = payload.passwordId;

      if (targetPasswordId) {
        const subtreeIds = new Set([targetPasswordId]);
        let changed = true;
        while (changed) {
          changed = false;
          const rows = await prisma.passwordEntry.findMany({
            where: { parentId: { in: [...subtreeIds] } },
            select: { id: true },
          });
          for (const row of rows) {
            if (!subtreeIds.has(row.id)) {
              subtreeIds.add(row.id);
              changed = true;
            }
          }
        }

        await prisma.passwordEntry.deleteMany({
          where: { id: { in: [...subtreeIds] } },
        });
      } else if (targetVaultId) {
        await prisma.passwordEntry.deleteMany({
          where: {
            vaultId: targetVaultId,
            deletedAt: { not: null },
          },
        });
      }
    }

    // Mark as APPROVED and record execution
    const updated = await prisma.adminApprovalRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId: req.user.id,
        responseNote: note || 'Approved by administrator',
        executedAt: new Date(),
      },
      include: {
        requester: { select: { id: true, fullName: true, email: true, role: true } },
        approver: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activity'),
        userId: req.user.id,
        action: 'APPROVE_REQUEST',
        targetType: 'APPROVAL_REQUEST',
        targetId: id,
        metadata: {
          actionType: request.actionType,
          title: request.title,
          requesterId: request.requesterId,
          approverId: req.user.id,
          responseNote: note || null,
        },
      },
    });

    res.json({
      message: 'Request approved and executed successfully',
      request: updated,
    });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ message: 'Server error executing approved request' });
  }
};

/**
 * POST /api/v1/admin-approvals/:id/reject
 * Rejects an approval request with an explanation note
 */
const rejectRequest = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const { id } = req.params;
    const { note } = req.body;

    const request = await prisma.adminApprovalRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ message: 'Approval request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: `Request is already ${request.status.toLowerCase()}` });
    }

    // Strict Owner-Only Policy: Only an Organization Owner can reject requests
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({
        message: 'Strict Owner-Only Policy: Only an Organization Owner has authority to reject approval requests.',
      });
    }

    if (request.requesterId === req.user.id) {
      return res.status(403).json({
        message: 'To dismiss your own pending request, please use Cancel Request instead.',
      });
    }

    const updated = await prisma.adminApprovalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId: req.user.id,
        responseNote: note || 'Rejected by administrator',
      },
      include: {
        requester: { select: { id: true, fullName: true, email: true, role: true } },
        approver: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activity'),
        userId: req.user.id,
        action: 'REJECT_REQUEST',
        targetType: 'APPROVAL_REQUEST',
        targetId: id,
        metadata: {
          actionType: request.actionType,
          title: request.title,
          requesterId: request.requesterId,
          rejectedBy: req.user.email,
          responseNote: note || null,
        },
      },
    });

    res.json({
      message: 'Approval request rejected',
      request: updated,
    });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Server error rejecting request' });
  }
};

/**
 * POST /api/v1/admin-approvals/:id/cancel
 * Allows the requester (or an Owner) to cancel a pending request
 */
const cancelRequest = async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const { id } = req.params;

    const request = await prisma.adminApprovalRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ message: 'Approval request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: `Request is already ${request.status.toLowerCase()}` });
    }

    if (request.requesterId !== req.user.id && req.user.role !== 'OWNER') {
      return res.status(403).json({ message: 'Only the original requester or an Owner can cancel this request' });
    }

    const updated = await prisma.adminApprovalRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        requester: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activity'),
        userId: req.user.id,
        action: 'CANCEL_APPROVAL_REQUEST',
        targetType: 'APPROVAL_REQUEST',
        targetId: id,
        metadata: {
          actionType: request.actionType,
          title: request.title,
          cancelledBy: req.user.email,
        },
      },
    });

    res.json({
      message: 'Approval request cancelled',
      request: updated,
    });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({ message: 'Server error cancelling request' });
  }
};

module.exports = {
  getPendingCount,
  getApprovalRequests,
  createApprovalRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
};
