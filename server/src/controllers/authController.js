const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const sendMail = require('../utils/sendMail');
const { renderEmail } = require('../utils/emailTemplate');
const {
  encryptEnvelope,
  decryptEnvelope,
  generateRecoveryKey,
} = require('../utils/recoveryKey');
const { verifyTOTP, verifyBackupCode, hashBackupCode } = require('../utils/totp');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=<>?/{}[\]|~`])/;

// Per-account brute-force lockout (in-memory).
// Tracks consecutive failed login attempts per email so that a single account
// cannot be hammered regardless of the source IP(s).
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const failedAttempts = new Map(); // email -> { count, lockedUntil }

function trackFailedAttempt(email) {
  const norm = (email || '').trim().toLowerCase();
  const record = failedAttempts.get(norm) || { count: 0, lockedUntil: 0 };

  // If already locked, keep the lock.
  if (record.lockedUntil > Date.now()) {
    return false;
  }

  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_WINDOW_MS;
    record.count = 0;
  }
  failedAttempts.set(norm, record);
  return true;
}

function resetFailedAttempts(email) {
  failedAttempts.delete((email || '').trim().toLowerCase());
}

function isAccountLocked(email) {
  const record = failedAttempts.get((email || '').trim().toLowerCase());
  if (!record) return false;
  if (record.lockedUntil > Date.now()) {
    return true;
  }
  // Lock expired — clear it.
  failedAttempts.delete((email || '').trim().toLowerCase());
  return false;
}

const validateEmail = (email) => {
  if (!email) return 'Email is required';
  const trimmed = email.trim();
  if (trimmed !== email) return 'Email must not contain leading or trailing spaces';
  if (trimmed.length > 254) return 'Email is too long (max 254 characters)';

  const atIndex = email.indexOf('@');
  if (atIndex < 1) return 'Email must have characters before the @';

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);

  if (localPart.length > 64) return 'Email local part is too long (max 64 characters)';
  if (!domainPart) return 'Email must contain a domain after the @';
  if (!domainPart.includes('.')) return 'Email domain must include a dot (e.g., gmail.com)';
  if (domainPart.startsWith('.')) return 'Email domain must not start with a dot';
  if (domainPart.endsWith('.')) return 'Email domain must not end with a dot';
  if (domainPart.includes('..')) return 'Email must not contain consecutive dots';

  const tld = domainPart.split('.').pop();
  if (tld.length < 2) return 'Email top-level domain must be at least 2 characters (e.g., .com, .org)';

  return null;
};

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const REFRESH_COOKIE_NAME = 'vaultix_refresh';

const signToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
};

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const createRefreshSession = async (userId, req) => {
  const token = crypto.randomBytes(48).toString('hex');
  const record = await prisma.refreshToken.create({
    data: {
      id: `RT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      userAgent: req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 255) : null,
      ipAddress: req ? getClientIp(req) : null,
    },
  });
  return { token, record };
};

const revokeAllRefreshTokens = (userId) =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

const setRefreshTokenCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  });
};

// Accept the refresh token from the httpOnly cookie (web client) or the
// request body (browser extension / API clients).
const getRefreshTokenFromRequest = (req) =>
  req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken || null;

const refresh = async (req, res) => {
  try {
    const suppliedToken = getRefreshTokenFromRequest(req);

    if (!suppliedToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(suppliedToken) },
    });

    if (!stored) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Rotation reuse detection: the same token presented twice means it was
    // stolen or used from a second device — revoke the whole session.
    if (stored.revokedAt) {
      await revokeAllRefreshTokens(stored.userId);
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Session revoked; please sign in again' });
    }

    if (new Date(stored.expiresAt) < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Session expired; please sign in again' });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });

    if (!user || user.isActive === false) {
      await revokeAllRefreshTokens(stored.userId);
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Account unavailable' });
    }

    // Rotate: revoke the old token and issue a fresh one.
    const { token: newRefreshToken, record: newRecord } = await createRefreshSession(user.id, req);

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: newRecord.id },
    });

    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      token: signToken(user),
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        masterPasswordHint: user.masterPasswordHint,
        hasMasterPassword: !!user.masterPasswordHash,
        encryptionSalt: user.encryptionSalt,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        vaultTimeoutMinutes: user.vaultTimeoutMinutes,
      },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const logout = async (req, res) => {
  try {
    const suppliedToken = getRefreshTokenFromRequest(req);

    if (suppliedToken) {
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(suppliedToken) },
      });
      if (stored && !stored.revokedAt) {
        await prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
      }
    }

    clearRefreshTokenCookie(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Only trust proxy-forwarded headers when the deployment runs behind a known
// reverse proxy (set TRUST_PROXY=true in production). Otherwise honor the
// actual socket address so clients cannot spoof their IP in audit logs.
const getClientIp = (req) => {
  if (process.env.TRUST_PROXY === 'true') {
    return (
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      req.ip ||
      ''
    );
  }
  return req.socket?.remoteAddress || req.ip || '';
};

const saveLoginActivity = async ({ req, userId, status }) => {
  try {
    const loginActivityId = `LOGIN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    await prisma.loginActivity.create({
      data: {
        id: loginActivityId,
        userId,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
        status,
      },
    });
  } catch (error) {
    console.error('Save login activity error:', error);
  }
};



const register = async (req, res) => {
  try {
    const { fullName, email, password, token } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (fullName.trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({ message: 'Password must include uppercase, lowercase, number, and special character' });
    }

    let role = 'USER';
    let emailVerified = false;

    if (token) {
      const invitation = await prisma.invitation.findUnique({
        where: { token },
      });

      if (!invitation || invitation.isUsed) {
        return res.status(400).json({ message: 'Invalid or already used invitation' });
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Invitation has expired' });
      }

      if (invitation.email.toLowerCase() !== email.trim().toLowerCase()) {
        return res.status(400).json({ message: 'This invitation was issued for a different email address' });
      }

      role = invitation.role;
      emailVerified = true; // Invited users are pre-verified
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const encryptionSalt = crypto.randomBytes(16).toString('hex');
    const userId = await generateId('user');

    // Generate email verification token for non-invited users
    const verificationToken = emailVerified
      ? null
      : crypto.randomBytes(32).toString('hex');
    const verificationExpiry = emailVerified
      ? null
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let user;

    if (token) {
      try {
        user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              id: userId,
              fullName,
              email: email.trim(),
              passwordHash,
              encryptionSalt,
              role,
              emailVerified: true,
            },
          });

          const updated = await tx.invitation.updateMany({
            where: { token, isUsed: false },
            data: { isUsed: true },
          });

          if (updated.count === 0) {
            throw new Error('INVITATION_ALREADY_USED');
          }

          return created;
        });
      } catch (error) {
        if (error.message === 'INVITATION_ALREADY_USED') {
          return res.status(400).json({ message: 'Invitation already used' });
        }
        throw error;
      }
    } else {
      user = await prisma.user.create({
        data: {
          id: userId,
          fullName,
          email: email.trim(),
          passwordHash,
          encryptionSalt,
          role,
          emailVerified: false,
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: verificationExpiry,
        },
      });
    }

    // Send verification email for non-invited users
    if (!emailVerified && verificationToken) {
      const verifyLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
sendMail({
        to: user.email,
        subject: 'Verify your Vaultix email',
        html: renderEmail({
          title: 'Verify your email address',
          body: 'Welcome to Vaultix! Click the button below to verify your email and activate your account.',
          buttonText: 'Verify Email',
          buttonUrl: verifyLink,
          accent: 'blue',
          footerNote:
            'This link expires in 24 hours. If you did not create this account, you can safely ignore this email.',
        }),
      }).catch(() => {
        // Email sending is best-effort
      });
    }

    const jwtToken = signToken(user);
    const { token: refreshToken } = await createRefreshSession(user.id, req);
    setRefreshTokenCookie(res, refreshToken);

    await saveLoginActivity({
      req,
      userId: user.id,
      status: 'SUCCESS',
    });

    res.status(201).json({
      message: emailVerified
        ? 'User registered successfully'
        : 'User registered successfully. Please verify your email.',
      token: jwtToken,
      refreshToken,
      emailVerified,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        encryptionSalt: user.encryptionSalt,
        hasMasterPassword: false,
        masterPasswordHint: null,
        emailVerified,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, twoFactorCode, twoFactorMethod, backupCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    // Per-account brute-force lockout: reject early when the account is
    // currently locked, before doing any expensive work.
    if (isAccountLocked(email)) {
      return res.status(429).json({
        message: 'Too many failed attempts. Please try again in a few minutes.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      trackFailedAttempt(email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.isActive === false) {
      await saveLoginActivity({
        req,
        userId: user.id,
        status: 'BLOCKED',
      });

      return res.status(403).json({
        message: 'Your account is inactive. Please contact administrator.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      trackFailedAttempt(email);
      await saveLoginActivity({
        req,
        userId: user.id,
        status: 'FAILED',
      });

      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // ── 2FA verification ──────────────────────────────────────────────────
    if (user.twoFactorEnabled) {
      // If no 2FA code provided yet, return a partial response asking for 2FA
      if (!twoFactorCode && !backupCode) {
        return res.status(200).json({
          requires2FA: true,
          twoFactorMethods: ['totp', 'backup'],
          user: {
            id: user.id,
            email: user.email,
          },
        });
      }

      let twoFactorVerified = false;

      if (backupCode) {
        // Verify backup code
        const backupCodes = user.twoFactorBackupCodes || [];
        const backupCodesArr = Array.isArray(backupCodes) ? backupCodes : [];
        twoFactorVerified = verifyBackupCode(backupCode, backupCodesArr);
        if (twoFactorVerified) {
          // Save remaining backup codes
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorBackupCodes: backupCodesArr },
          });
        }
      } else if (twoFactorMethod === 'totp' || !twoFactorMethod) {
        // Verify TOTP code
        if (!user.twoFactorSecret) {
          return res.status(400).json({ message: '2FA is not properly configured' });
        }
        twoFactorVerified = verifyTOTP(user.twoFactorSecret, twoFactorCode);
      }

      if (!twoFactorVerified) {
        trackFailedAttempt(email);
        await saveLoginActivity({
          req,
          userId: user.id,
          status: 'FAILED',
        });
        return res.status(400).json({ message: 'Invalid 2FA code' });
      }
    }
    // ── End 2FA verification ──────────────────────────────────────────────

    resetFailedAttempts(email);
    const token = signToken(user);
    const { token: refreshToken } = await createRefreshSession(user.id, req);
    setRefreshTokenCookie(res, refreshToken);

    await saveLoginActivity({
      req,
      userId: user.id,
      status: 'SUCCESS',
    });

    res.status(200).json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        masterPasswordHint: user.masterPasswordHint,
        hasMasterPassword: !!user.masterPasswordHash,
        encryptionSalt: user.encryptionSalt,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        vaultTimeoutMinutes: user.vaultTimeoutMinutes,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      masterPasswordHint: user.masterPasswordHint,
      hasMasterPassword: !!user.masterPasswordHash,
      hasRecoveryKey: !!(user.recoveryKey && user.recoveryKeyEscrow),
      encryptionSalt: user.encryptionSalt,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      vaultTimeoutMinutes: user.vaultTimeoutMinutes,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const setMasterPassword = async (req, res) => {
  try {
    const { masterPassword, hint } = req.body;

    if (!masterPassword) {
      return res.status(400).json({ message: 'Master password is required' });
    }

    if (masterPassword.length < 8) {
      return res.status(400).json({ message: 'Master password must be at least 8 characters' });
    }

    if (!PASSWORD_REGEX.test(masterPassword)) {
      return res.status(400).json({
        message: 'Master password must include uppercase, lowercase, number, and special character',
      });
    }

    if (hint && hint.length > 100) {
      return res.status(400).json({ message: 'Hint must be under 100 characters' });
    }

    const masterPasswordHash = await bcrypt.hash(masterPassword, 12);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        masterPasswordHash,
        masterPasswordHint: hint || null,
      },
    });

    res.json({ message: 'Master password set successfully' });
  } catch (error) {
    console.error('Set master password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName, email, currentPassword } = req.body;
    const userId = req.user.id;

    if (!fullName || !email) {
      return res.status(400).json({ message: 'Full name and email are required' });
    }

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    if (fullName.trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Changing the email changes the account's recovery channel — require the
    // current account password to confirm, so a stolen access token alone
    // cannot hijack the account.
    if (email !== user.email) {
      if (!currentPassword) {
        return res.status(400).json({
          message: 'Current password is required to change your email',
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { fullName: fullName.trim(), email },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        masterPasswordHash: true,
        masterPasswordHint: true,
        encryptionSalt: true,
        createdAt: true,
      },
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        ...updated,
        hasMasterPassword: !!updated.masterPasswordHash,
        masterPasswordHint: updated.masterPasswordHint,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        message: 'New password must include uppercase, lowercase, number, and special character',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Password changed — revoke every existing session, then immediately mint
    // a fresh one for the current device so the user isn't logged out here.
    await revokeAllRefreshTokens(userId);
    const { token: sessionToken } = await createRefreshSession(userId, req);
    setRefreshTokenCookie(res, sessionToken);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    // Always respond with the same message so we don't reveal whether an
    // email is registered (prevents account enumeration).
    const genericMessage =
      'If an account exists for that email, a password reset link has been sent.';

    if (!user || user.isActive === false) {
      return res.json({ message: genericMessage });
    }

    // Bind the token to the current password hash so it becomes unusable as
    // soon as the password actually changes (single-use per password state).
    const passwordFingerprint = crypto
      .createHash('sha256')
      .update(user.passwordHash)
      .digest('hex');

    const resetToken = jwt.sign(
      {
        sub: user.id,
        type: 'password-reset',
        ph: passwordFingerprint,
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '10m' }
    );

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    await sendMail({
      to: user.email,
      subject: 'Vaultix Password Reset',
      html: renderEmail({
        title: 'Reset your Vaultix password',
        body: 'We received a request to reset the password for your Vaultix account. Click the button below to choose a new one.',
        buttonText: 'Reset Password',
        buttonUrl: resetLink,
        accent: 'indigo',
        footerNote:
          'This link expires in 10 minutes. If you did not request this, you can safely ignore this email.',
      }),
    });

    res.json({ message: genericMessage });
  } catch (error) {
    console.error('Request password reset error:', error);
    const isAuthError = error?.code === 'EAUTH';
    res.status(500).json({
      message: isAuthError
        ? 'Email sending failed: invalid Gmail credentials. Use a 16-character App Password (myaccount.google.com/apppasswords).'
        : 'Failed to send password reset email',
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must include uppercase, lowercase, number, and special character',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    if (decoded.type !== 'password-reset' || !decoded.sub || !decoded.ph) {
      return res.status(400).json({ message: 'Invalid reset link' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || user.isActive === false) {
      return res.status(400).json({ message: 'Invalid reset link' });
    }

    // Token is only valid while the password hasn't already changed.
    const currentFingerprint = crypto
      .createHash('sha256')
      .update(user.passwordHash)
      .digest('hex');

    if (currentFingerprint !== decoded.ph) {
      return res.status(400).json({ message: 'Reset link has already been used' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Password changed — revoke all refresh sessions and clear the cookie.
    await revokeAllRefreshTokens(user.id);
    clearRefreshTokenCookie(res);

    // Restore login ability after a reset, regardless of any lockout state.
    resetFailedAttempts(user.email);

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const verifyMasterPassword = async (req, res) => {
  try {
    const { masterPassword } = req.body;

    if (!masterPassword) {
      return res.status(400).json({ message: 'Master password is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user || !user.masterPasswordHash) {
      return res.status(400).json({ message: 'Master password not set' });
    }

    const isMatch = await bcrypt.compare(masterPassword, user.masterPasswordHash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid master password' });
    }

    res.json({ verified: true });
  } catch (error) {
    console.error('Verify master password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const changeMasterPassword = async (req, res) => {
  try {
    const { currentMasterPassword, newMasterPassword, hint } = req.body;
    const userId = req.user.id;

    if (!currentMasterPassword || !newMasterPassword) {
      return res.status(400).json({ message: 'Current and new master password are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.masterPasswordHash) {
      return res.status(400).json({ message: 'Master password not set' });
    }

    const isMatch = await bcrypt.compare(currentMasterPassword, user.masterPasswordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current master password is incorrect' });
    }

    if (newMasterPassword.length < 8) {
      return res.status(400).json({ message: 'New master password must be at least 8 characters' });
    }

    if (!PASSWORD_REGEX.test(newMasterPassword)) {
      return res.status(400).json({
        message: 'New master password must include uppercase, lowercase, number, and special character',
      });
    }

    const masterPasswordHash = await bcrypt.hash(newMasterPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: {
        masterPasswordHash,
        masterPasswordHint: hint || null,
      },
    });

    res.json({ message: 'Master password changed successfully' });
  } catch (error) {
    console.error('Change master password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const reencryptPasswords = async (req, res) => {
  try {
    const { passwords } = req.body;

    if (!passwords || !Array.isArray(passwords) || passwords.length === 0) {
      return res.status(400).json({ message: 'passwords array is required' });
    }

    if (passwords.length > 1000) {
      return res.status(400).json({ message: 'Cannot re-encrypt more than 1000 passwords at once' });
    }

    const updates = passwords.map((pw) =>
      prisma.passwordEntry.update({
        where: { id: pw.id, createdById: req.user.id },
        data: {
          encryptedPassword: pw.encryptedPassword,
          ...(pw.encryptedNote !== undefined && { encryptedNote: pw.encryptedNote }),
          ...(pw.encryptedFields !== undefined && { encryptedFields: pw.encryptedFields }),
        },
      })
    );

    await prisma.$transaction(updates);

    res.json({ message: 'Passwords re-encrypted successfully' });
  } catch (error) {
    console.error('Re-encrypt passwords error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Stores a recovery key + an escrowed (recovery-key-encrypted) copy of the RSA
// private key. Called during master-password setup so that a forgotten master
// password can be recovered without losing vault data.
const setupRecoveryKey = async (req, res) => {
  try {
    const { recoveryKey, escrow } = req.body;
    const userId = req.user.id;

    if (!recoveryKey || !escrow) {
      return res.status(400).json({ message: 'Recovery key and escrow are required' });
    }

    // Sanity-check the escrow can actually be decrypted with the key before
    // persisting it, so a bad setup never silently breaks future recovery.
    let privateKey;
    try {
      privateKey = decryptEnvelope(escrow, recoveryKey);
    } catch {
      return res.status(400).json({ message: 'Recovery key could not unlock the escrow' });
    }

    if (!privateKey) {
      return res.status(400).json({ message: 'Recovery escrow is empty' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { recoveryKey, recoveryKeyEscrow: escrow },
    });

    res.json({ message: 'Recovery key saved successfully' });
  } catch (error) {
    console.error('Setup recovery key error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Step 1 of the forgotten-master-password flow: email the user their recovery
// key so they can unlock the escrow and set a new master password.
const requestMasterRecoveryKey = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    const genericMessage =
      'If an account exists for that email and has a recovery key set up, the key has been sent to your inbox.';

    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (!user || user.isActive === false || !user.recoveryKey || !user.recoveryKeyEscrow) {
      return res.json({ message: genericMessage });
    }

    await sendMail({
      to: user.email,
      subject: 'Vaultix Master Password Recovery Key',
      html: renderEmail({
        title: 'Your Vaultix recovery key',
        body: 'Use the recovery key below to reset your master password and recover your vault data.',
        accent: 'emerald',
        extraHtml: `
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0">
            <tr>
              <td align="center" style="padding:20px 24px;background-color:#ecfdf5;border:1px dashed #10b981;border-radius:10px">
                <span style="font-family:Consolas,Menlo,monospace;font-size:22px;font-weight:700;letter-spacing:3px;color:#047857">${user.recoveryKey}</span>
              </td>
            </tr>
          </table>
        `,
        footerNote:
          'Keep this key private. It grants full access to your encrypted vault. If you did not request this, please change your password immediately and contact your administrator.',
      }),
    });

    res.json({ message: genericMessage });
  } catch (error) {
    console.error('Request master recovery key error:', error);
    const isAuthError = error?.code === 'EAUTH';
    res.status(500).json({
      message: isAuthError
        ? 'Email sending failed: invalid Gmail credentials. Use a 16-character App Password (myaccount.google.com/apppasswords).'
        : 'Failed to send recovery key email',
    });
  }
};

// Final step of the forgotten-master-password flow. Verifies the recovery key,
// decrypts the escrowed private key, re-encrypts it with the new master
// password, and updates the master password + hint. Vault data is preserved.
const resetMasterPasswordWithRecoveryKey = async (req, res) => {
  try {
    const { email, recoveryKey, newMasterPassword, hint } = req.body;

    if (!email || !recoveryKey || !newMasterPassword) {
      return res.status(400).json({
        message: 'Email, recovery key, and new master password are required',
      });
    }

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    if (newMasterPassword.length < 8) {
      return res.status(400).json({ message: 'Master password must be at least 8 characters' });
    }

    if (!PASSWORD_REGEX.test(newMasterPassword)) {
      return res.status(400).json({
        message: 'Master password must include uppercase, lowercase, number, and special character',
      });
    }

    if (hint && hint.length > 100) {
      return res.status(400).json({ message: 'Hint must be under 100 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (!user || user.isActive === false) {
      return res.status(400).json({ message: 'Invalid recovery details' });
    }

    if (!user.recoveryKey || !user.recoveryKeyEscrow) {
      return res.status(400).json({ message: 'No recovery key is set up for this account' });
    }

    // Constant-ish compare to avoid trivial timing leaks.
    const keyMatches =
      Buffer.from(user.recoveryKey || '').toString().toLowerCase() ===
      Buffer.from(recoveryKey || '').toString().trim().toLowerCase();

    if (!keyMatches) {
      return res.status(400).json({ message: 'Invalid recovery key' });
    }

    // Decrypt the escrowed private key using the recovery key.
    let privateKeyJwk;
    try {
      privateKeyJwk = decryptEnvelope(user.recoveryKeyEscrow, recoveryKey.trim());
      JSON.parse(privateKeyJwk); // ensure it's valid JWK JSON
    } catch {
      return res.status(400).json({ message: 'Recovery key could not unlock your vault' });
    }

    // Re-encrypt the same private key with the new master password so the
    // existing key pair (and therefore all vault data) is preserved.
    const encryptedPrivateKey = encryptEnvelope(privateKeyJwk, newMasterPassword);
    const masterPasswordHash = await bcrypt.hash(newMasterPassword, 12);

    const encryptedPrivateKeyParsed =
      typeof encryptedPrivateKey === 'string'
        ? JSON.parse(encryptedPrivateKey)
        : encryptedPrivateKey;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          masterPasswordHash,
          masterPasswordHint: hint || null,
          // Recovery key is single-use — clear it once used.
          recoveryKey: null,
          recoveryKeyEscrow: null,
        },
      });

      const existing = await tx.userKeyPair.findUnique({
        where: { userId: user.id },
      });

      if (existing) {
        await tx.userKeyPair.update({
          where: { userId: user.id },
          data: {
            encryptedPrivateKey: encryptedPrivateKeyParsed,
            salt: existing.salt || user.encryptionSalt,
          },
        });
      } else {
        // If no key pair exists, re-create it from the recovered key pair.
        if (user.keyPair) {
          await tx.userKeyPair.create({
            data: {
              id: await generateId('keyPair'),
              userId: user.id,
              encryptedPrivateKey: encryptedPrivateKeyParsed,
              publicKey: user.keyPair.publicKey,
              salt: user.keyPair.salt || user.encryptionSalt,
            },
          });
        }
      }
    });

    // Reset any login lockout state for this account.
    resetFailedAttempts(user.email);

    res.json({ message: 'Master password reset successfully' });
  } catch (error) {
    console.error('Reset master password with recovery key error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const resetMasterPassword = async (req, res) => {
  try {
    const { newMasterPassword, hint, encryptedPrivateKey, publicKey, salt, accountPassword } = req.body;
    const userId = req.user.id;

    if (!newMasterPassword || !encryptedPrivateKey || !publicKey || !salt) {
      return res.status(400).json({
        message: 'New master password, encrypted private key, public key, and salt are required',
      });
    }

    // Resetting the master password and rotating the RSA keypair is a
    // destructive, credential-level operation. A bare access token is not
    // enough — the caller must re-prove the account password so a stolen
    // session (e.g. a leaked JWT) cannot silently take over the vault.
    if (!accountPassword) {
      return res.status(400).json({
        message: 'Account password is required to reset the master password',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(accountPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Account password is incorrect' });
    }

    if (newMasterPassword.length < 8) {
      return res.status(400).json({ message: 'Master password must be at least 8 characters' });
    }

    if (!PASSWORD_REGEX.test(newMasterPassword)) {
      return res.status(400).json({
        message: 'Master password must include uppercase, lowercase, number, and special character',
      });
    }

    if (hint && hint.length > 100) {
      return res.status(400).json({ message: 'Hint must be under 100 characters' });
    }

    const masterPasswordHash = await bcrypt.hash(newMasterPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          masterPasswordHash,
          masterPasswordHint: hint || null,
        },
      });

      const encryptedPrivateKeyParsed =
        typeof encryptedPrivateKey === 'string'
          ? JSON.parse(encryptedPrivateKey)
          : encryptedPrivateKey;

      const existing = await tx.userKeyPair.findUnique({
        where: { userId },
      });

      if (existing) {
        await tx.userKeyPair.update({
          where: { userId },
          data: { encryptedPrivateKey: encryptedPrivateKeyParsed, publicKey, salt },
        });
      } else {
        await tx.userKeyPair.create({
          data: {
            id: await generateId('keyPair'),
            userId,
            encryptedPrivateKey: encryptedPrivateKeyParsed,
            publicKey,
            salt,
          },
        });
      }
    });

    // Credential changed — revoke every other session, then mint a fresh one
    // for the current device so the user isn't logged out here.
    await revokeAllRefreshTokens(userId);
    const { token: sessionToken } = await createRefreshSession(userId, req);
    setRefreshTokenCookie(res, sessionToken);

    res.json({ message: 'Master password reset successfully' });
  } catch (error) {
    console.error('Reset master password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const requestEmailVerification = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
    });

    const verifyLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    await sendMail({
      to: user.email,
      subject: 'Verify your Vaultix email',
      html: renderEmail({
        title: 'Verify your email address',
        body: 'Welcome to Vaultix! Click the button below to verify your email and activate your account.',
        buttonText: 'Verify Email',
        buttonUrl: verifyLink,
        accent: 'blue',
        footerNote:
          'This link expires in 24 hours. If you did not create this account, you can safely ignore this email.',
      }),
    });

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Request email verification error:', error);
    res.status(500).json({
      message: error?.code === 'EAUTH'
        ? 'Email sending failed: invalid Gmail credentials. Use a 16-character App Password (myaccount.google.com/apppasswords).'
        : 'Failed to send verification email',
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Email is already verified', verified: true });
    }

    if (user.emailVerificationExpiry && new Date(user.emailVerificationExpiry) < new Date()) {
      return res.status(400).json({ message: 'Verification link has expired. Please request a new one.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    await prisma.activityLog.create({
      data: {
        id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: user.id,
        action: 'VERIFY_EMAIL',
      },
    });

    res.json({ message: 'Email verified successfully', verified: true });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
  saveLoginActivity,
  login,
  refresh,
  logout,
  me,
  setMasterPassword,
  setupRecoveryKey,
  requestMasterRecoveryKey,
  resetMasterPasswordWithRecoveryKey,
  verifyMasterPassword,
  updateProfile,
  changePassword,
  requestPasswordReset,
  resetPassword,
  changeMasterPassword,
  resetMasterPassword,
  reencryptPasswords,
  requestEmailVerification,
  verifyEmail,
};