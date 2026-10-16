const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');

const {
  getOrCreateMyVault,
  createMyVaultFolder,
  getMyVaultFolders,
  createMyVaultPassword,
  getMyVaultPasswords,
  updateMyVaultFolder,
  deleteMyVaultFolder,
  restoreMyVaultFolder,
  purgeMyVaultFolder,
  getMyVaultFolderTrash,
  updateMyVaultPassword,
  deleteMyVaultPassword,
  restoreMyVaultPassword,
  purgeMyVaultPassword,
  getMyVaultTrash,
  getPasswordShares,
} = require('../controllers/personalVaultController');

const router = express.Router();

router.use(authenticate);

router.get('/', getOrCreateMyVault);

router.get('/folders/trash', getMyVaultFolderTrash);
router.get('/folders', getMyVaultFolders);
router.post('/folders', createMyVaultFolder);
router.put('/folders/:folderId', updateMyVaultFolder);
router.delete('/folders/:folderId', deleteMyVaultFolder);
router.post('/folders/:folderId/restore', restoreMyVaultFolder);
router.delete('/folders/:folderId/purge', purgeMyVaultFolder);

router.get('/passwords', getMyVaultPasswords);
router.post('/passwords', createMyVaultPassword);
router.put('/passwords/:passwordId', updateMyVaultPassword);
router.delete('/passwords/:passwordId', deleteMyVaultPassword);
router.post('/passwords/:passwordId/restore', restoreMyVaultPassword);
router.delete('/passwords/:passwordId/purge', purgeMyVaultPassword);
router.get('/trash', getMyVaultTrash);

router.get('/passwords/:passwordId/shares', getPasswordShares);

module.exports = router;