const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/authMiddleware');
const {
  createFolder,
  getFoldersByVault,
  updateFolder,
  shareFolder,
  getFolderActivityLogs,
  deleteFolder,
  restoreFolder,
  purgeFolder,
  getFolderTrash,
  getFolderById,
  updateFolderPermission,
  deleteFolderPermission,
  getFolderWrapRecipients,
  blockFolderUser,
} = require('../controllers/folderController');
const { requireFolderAccess } = require('../utils/permissions');

router.post(
  '/',
  authenticate,
  createFolder
);

router.get(
  '/vault/:vaultId/trash',
  authenticate,
  getFolderTrash
);

router.get(
  '/vault/:vaultId',
  authenticate,
  getFoldersByVault
);

router.post(
  '/:id/restore',
  authenticate,
  restoreFolder
);

router.delete(
  '/:id/purge',
  authenticate,
  purgeFolder
);

router.put(
  '/:id',
  authenticate,
  requireFolderAccess(['ADMINISTRATOR']),
  updateFolder
);

router.post(
  '/:id/share',
  authenticate,
  requireFolderAccess(['ADMINISTRATOR']),
  shareFolder
);

router.post(
  '/:id/block',
  authenticate,
  requireFolderAccess(['ADMINISTRATOR']),
  blockFolderUser
);

router.get(
  '/:id/history',
  authenticate,
  requireFolderAccess(['ADMINISTRATOR', 'READ_WRITE', 'READ_ONLY', 'FULL_ACCESS']),
  getFolderActivityLogs
);

router.delete(
  '/:id',
  authenticate,
  requireFolderAccess(['ADMINISTRATOR']),
  deleteFolder
);

router.get(
  '/:id/wrap-recipients',
  authenticate,
  getFolderWrapRecipients
);

router.get(
  '/:id',
  authenticate,
  getFolderById
);

router.put(
  '/permissions/:id',
  authenticate,
  updateFolderPermission
);

router.delete(
  '/permissions/:id',
  authenticate,
  deleteFolderPermission
);

module.exports = router;