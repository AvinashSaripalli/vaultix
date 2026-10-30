const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const {
  authLimiter,
  refreshLimiter,
  sensitiveLimiter,
  masterPasswordLimiter,
} = require('../utils/rateLimiters');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/bitrix/sso', authLimiter, authController.bitrixSso);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authLimiter, authController.requestPasswordReset);
router.post('/reset-password', sensitiveLimiter, authController.resetPassword);
router.get('/me', authenticate, authController.me);
router.post('/set-master-password', authenticate, authController.setMasterPassword);
router.post('/setup-recovery-key', authenticate, authController.setupRecoveryKey);
router.post('/forgot-master-password', authLimiter, authController.requestMasterRecoveryKey);
router.post('/reset-master-password-with-recovery-key', sensitiveLimiter, authController.resetMasterPasswordWithRecoveryKey);
router.post('/verify-master-password', masterPasswordLimiter, authenticate, authController.verifyMasterPassword);
router.put('/me', authenticate, authController.updateProfile);
router.put('/change-password', sensitiveLimiter, authenticate, authController.changePassword);
router.put('/change-master-password', sensitiveLimiter, authenticate, authController.changeMasterPassword);
router.post('/reset-master-password', sensitiveLimiter, authenticate, authController.resetMasterPassword);
router.post('/reencrypt-passwords', authenticate, authController.reencryptPasswords);
router.post('/request-email-verification', authenticate, authController.requestEmailVerification);
router.post('/verify-email', sensitiveLimiter, authController.verifyEmail);

module.exports = router;
