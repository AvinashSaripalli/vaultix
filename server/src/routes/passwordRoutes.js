const express = require('express');
const router = express.Router();

const { authenticate, require2faIfEnforced } = require('../middlewares/authMiddleware');
const passwordController = require('../controllers/passwordController');

router.use(authenticate, require2faIfEnforced);

router.post('/', authenticate, passwordController.createPassword);

router.post('/import-excel', authenticate, passwordController.importPasswordsFromExcel);
router.get('/owned', authenticate, passwordController.getPasswordsOwnedByUser);
router.get('/vault/:vaultId/items-needing-wrap', authenticate, passwordController.getItemsNeedingWrapping);
router.post('/batch-wrap', authenticate, passwordController.batchWrapKeys);

router.get('/vault/:vaultId', authenticate, passwordController.getPasswordsByVault);
router.get('/vault/:vaultId/trash', authenticate, passwordController.getTrash);
router.get('/:id', authenticate, passwordController.getPasswordById);
router.put('/:id', authenticate, passwordController.updatePassword);
router.delete('/:id', authenticate, passwordController.deletePassword);
router.post('/:id/restore', authenticate, passwordController.restorePassword);
router.delete('/:id/purge', authenticate, passwordController.purgePassword);
router.post('/:id/copy-log', authenticate, passwordController.logCopyPassword);
router.post('/:id/view-log', authenticate, passwordController.logViewPassword);

module.exports = router;