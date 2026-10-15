const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Only accept tokens explicitly minted as access tokens. Tokens signed
    // for other purposes (e.g. password reset) must never authorize API calls.
    if (decoded.type !== 'access') {
      return res.status(401).json({ message: 'Invalid token type' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        tokenVersion: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'Account is deactivated or no longer exists' });
    }

    if (
      decoded.tokenVersion !== undefined &&
      user.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    req.user = {
      ...decoded,
      email: user.email,
      role: user.role,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const { getEffectiveOrganizationPolicy } = require('../utils/organizationPolicy');

const require2faIfEnforced = async (req, res, next) => {
  try {
    const policy = await getEffectiveOrganizationPolicy();
    if (policy?.requireTwoFactor && !req.user?.twoFactorEnabled) {
      return res.status(403).json({
        code: '2FA_ENFORCED',
        message: 'Your organization enforces Two-Factor Authentication. Please enable 2FA in Security Settings to access company vaults.',
      });
    }
    next();
  } catch (err) {
    console.error('2FA policy enforcement check error:', err);
    next();
  }
};

module.exports = { authenticate, require2faIfEnforced };