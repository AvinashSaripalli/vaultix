const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const generateId = require('../utils/generateId');
const {
  generateTOTPSecret,
  verifyTOTP,
  generateQRCode,
  generateBackupCodes,
  hashBackupCode,
} = require('../utils/totp');
const {
  getRpConfig,
  generateRegistrationOpts,
  verifyRegistrationOpts,
  generateAuthenticationOpts,
  verifyAuthenticationOpts,
} = require('../utils/webauthn');
const { getEffectiveOrganizationPolicy } = require('../utils/organizationPolicy');

// ─── TOTP ──────────────────────────────────────────────────────────────────

const getTOTPStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { twoFactorEnabled: true },
    });

    res.json({ enabled: user.twoFactorEnabled });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const setupTOTP = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, twoFactorEnabled: true },
    });

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled. Disable it first.' });
    }

    const { secret, uri } = generateTOTPSecret(user.email);
    const qrCode = await generateQRCode(uri);

    // Store the secret temporarily (not yet enabled)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorSecret: secret },
    });

    res.json({ secret, qrCode });
  } catch (error) {
    console.error('Setup TOTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const verifyAndEnableTOTP = async (req, res) => {
  try {
    const { code, password } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Verification code is required' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Account password is required to enable 2FA' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.twoFactorSecret) {
      return res.status(400).json({ message: 'Please set up TOTP first' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    // Verify account password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Account password is incorrect' });
    }

    // Verify the TOTP code
    const isValid = verifyTOTP(user.twoFactorSecret, code);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Generate backup codes
    const rawCodes = generateBackupCodes(10);
    const hashedCodes = rawCodes.map(hashBackupCode);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: hashedCodes,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: req.user.id,
        action: 'ENABLE_2FA',
      },
    });

    res.json({ message: '2FA enabled successfully', backupCodes: rawCodes });
  } catch (error) {
    console.error('Verify and enable TOTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const disableTOTP = async (req, res) => {
  try {
    const { password, code } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Account password is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Account password is incorrect' });
    }

    // If 2FA is enabled, require a TOTP code to disable
    if (user.twoFactorEnabled) {
      if (!code) {
        return res.status(400).json({ message: '2FA code is required to disable 2FA' });
      }
      const isValid = verifyTOTP(user.twoFactorSecret, code);
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    });

    await prisma.activityLog.create({
      data: {
        id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: req.user.id,
        action: 'DISABLE_2FA',
      },
    });

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('Disable TOTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const regenerateBackupCodes = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Account password is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Account password is incorrect' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA must be enabled to regenerate backup codes' });
    }

    const rawCodes = generateBackupCodes(10);
    const hashedCodes = rawCodes.map(hashBackupCode);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorBackupCodes: hashedCodes },
    });

    res.json({ backupCodes: rawCodes });
  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── WebAuthn ──────────────────────────────────────────────────────────────

const webAuthnRegisterBegin = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, fullName: true },
    });

    const existingCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId: req.user.id },
    });

    const options = await generateRegistrationOpts(user, existingCredentials);

    // Store the challenge in the session (via a signed cookie or in-memory)
    // For simplicity, we'll store it in a short-lived DB field or use the response
    // We'll pass it back and verify on completion
    res.json({ options, challenge: options.challenge });
  } catch (error) {
    console.error('WebAuthn register begin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const webAuthnRegisterFinish = async (req, res) => {
  try {
    const { response, challenge, friendlyName } = req.body;

    if (!response || !challenge) {
      return res.status(400).json({ message: 'Response and challenge are required' });
    }

    const verification = await verifyRegistrationOpts(response, challenge, req.user);

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ message: 'Registration verification failed' });
    }

    const { credential } = verification.registrationInfo;

    await prisma.webAuthnCredential.create({
      data: {
        id: await generateId('webauthn'),
        userId: req.user.id,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: BigInt(credential.counter),
        transports: response.response?.transports
          ? JSON.stringify(response.response.transports)
          : null,
        attestationFormat: credential.fmt || null,
        friendlyName: friendlyName || null,
      },
    });

    res.json({ verified: true, credentialId: credential.id });
  } catch (error) {
    console.error('WebAuthn register finish error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const webAuthnAuthenticateBegin = async (req, res) => {
  try {
    const { credentialIds } = req.body;

    const credentials = credentialIds
      ? await prisma.webAuthnCredential.findMany({
          where: { credentialId: { in: credentialIds } },
        })
      : [];

    const options = await generateAuthenticationOpts(credentials);

    res.json({ options, challenge: options.challenge });
  } catch (error) {
    console.error('WebAuthn authenticate begin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const webAuthnAuthenticateFinish = async (req, res) => {
  try {
    const { response, challenge } = req.body;

    if (!response || !challenge) {
      return res.status(400).json({ message: 'Response and challenge are required' });
    }

    const credentialId = response.id;

    const credential = await prisma.webAuthnCredential.findUnique({
      where: { credentialId },
    });

    if (!credential) {
      return res.status(400).json({ message: 'Credential not found' });
    }

    const verification = await verifyAuthenticationOpts(response, challenge, credential);

    if (!verification.verified) {
      return res.status(400).json({ message: 'Authentication verification failed' });
    }

    // Update the counter
    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    res.json({ verified: true, userId: credential.userId });
  } catch (error) {
    console.error('WebAuthn authenticate finish error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getWebAuthnCredentials = async (req, res) => {
  try {
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        credentialId: true,
        friendlyName: true,
        attestationFormat: true,
        createdAt: true,
      },
    });

    res.json({ credentials });
  } catch (error) {
    console.error('Get WebAuthn credentials error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const removeWebAuthnCredential = async (req, res) => {
  try {
    const { credentialId } = req.params;

    const credential = await prisma.webAuthnCredential.findUnique({
      where: { credentialId },
    });

    if (!credential || credential.userId !== req.user.id) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    await prisma.webAuthnCredential.delete({
      where: { credentialId },
    });

    res.json({ message: 'Credential removed' });
  } catch (error) {
    console.error('Remove WebAuthn credential error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Vault Timeout ─────────────────────────────────────────────────────────

const getVaultTimeout = async (req, res) => {
  try {
    const [user, policy] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { vaultTimeoutMinutes: true },
      }),
      getEffectiveOrganizationPolicy(),
    ]);

    const userSetting = user?.vaultTimeoutMinutes || 15;
    const maxAllowed = policy?.maxVaultTimeoutMinutes || null;
    const effectiveTimeout = maxAllowed ? Math.min(userSetting, maxAllowed) : userSetting;

    res.json({
      vaultTimeoutMinutes: effectiveTimeout,
      userConfiguredMinutes: userSetting,
      maxAllowedMinutes: maxAllowed,
    });
  } catch (error) {
    console.error('Get vault timeout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateVaultTimeout = async (req, res) => {
  try {
    const { vaultTimeoutMinutes } = req.body;

    if (vaultTimeoutMinutes === undefined || vaultTimeoutMinutes === null) {
      return res.status(400).json({ message: 'vaultTimeoutMinutes is required' });
    }

    const value = Number(vaultTimeoutMinutes);
    if (!Number.isFinite(value) || value < 1 || value > 480) {
      return res.status(400).json({ message: 'Timeout must be between 1 and 480 minutes' });
    }

    const policy = await getEffectiveOrganizationPolicy();
    if (policy?.maxVaultTimeoutMinutes && value > policy.maxVaultTimeoutMinutes) {
      return res.status(400).json({
        message: `Organization policy limits vault timeout to a maximum of ${policy.maxVaultTimeoutMinutes} minutes.`,
      });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { vaultTimeoutMinutes: value },
    });

    res.json({ vaultTimeoutMinutes: value });
  } catch (error) {
    console.error('Update vault timeout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTOTPStatus,
  setupTOTP,
  verifyAndEnableTOTP,
  disableTOTP,
  regenerateBackupCodes,
  webAuthnRegisterBegin,
  webAuthnRegisterFinish,
  webAuthnAuthenticateBegin,
  webAuthnAuthenticateFinish,
  getWebAuthnCredentials,
  removeWebAuthnCredential,
  getVaultTimeout,
  updateVaultTimeout,
};
