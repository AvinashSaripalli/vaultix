const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const approvalController = require('../controllers/approvalController');

router.use(authenticate);

router.get('/pending-count', approvalController.getPendingCount);
router.get('/', approvalController.getApprovalRequests);
router.post('/', approvalController.createApprovalRequest);
router.post('/:id/approve', approvalController.approveRequest);
router.post('/:id/reject', approvalController.rejectRequest);
router.post('/:id/cancel', approvalController.cancelRequest);

module.exports = router;
