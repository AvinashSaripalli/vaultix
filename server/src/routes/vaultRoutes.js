const express = require('express');
const router = express.Router();

const { authenticate, require2faIfEnforced } = require('../middlewares/authMiddleware');
const vaultController = require('../controllers/vaultController');

router.get('/', authenticate, require2faIfEnforced, vaultController.getVaults);
router.post('/', authenticate, require2faIfEnforced, vaultController.createVault);
router.get('/:slug', authenticate, require2faIfEnforced, vaultController.getVaultBySlug);
router.post('/:id/share', authenticate, require2faIfEnforced, vaultController.shareVault);
router.post('/:id/unshare', authenticate, require2faIfEnforced, vaultController.unshareVault);
router.get('/:id/policy', authenticate, require2faIfEnforced, vaultController.getVaultPolicy);
router.put('/:id/policy', authenticate, require2faIfEnforced, vaultController.setVaultPolicy);

module.exports = router;