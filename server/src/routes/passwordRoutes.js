const express = require('express');
const router = express.Router();

const { authenticate, require2faIfEnforced } = require('../middlewares/authMiddleware');
const passwordController = require('../controllers/passwordController');

router.use(authenticate, require2faIfEnforced);

router.post('/', passwordController.createPassword);

router.post('/import-excel', passwordController.importPasswordsFromExcel);
router.get('/owned', passwordController.getPasswordsOwnedByUser);
router.get('/vault/:vaultId/items-needing-wrap', passwordController.getItemsNeedingWrapping);
router.post('/batch-wrap', passwordController.batchWrapKeys);

router.get('/vault/:vaultId', passwordController.getPasswordsByVault);
router.get('/vault/:vaultId/trash', passwordController.getTrash);
router.get('/:id', passwordController.getPasswordById);
router.get('/:id/revisions', passwordController.getPasswordRevisions);
router.post('/:id/revisions/:revisionId/restore', passwordController.restorePasswordRevision);
router.get('/:id/activity', passwordController.getPasswordActivity);
router.put('/:id', passwordController.updatePassword);
router.delete('/:id', passwordController.deletePassword);
router.post('/:id/restore', passwordController.restorePassword);
router.delete('/:id/purge', passwordController.purgePassword);
router.post('/:id/copy-log', passwordController.logCopyPassword);
router.post('/:id/view-log', passwordController.logViewPassword);

module.exports = router;