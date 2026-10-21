const prisma = require('../config/prisma');
const crypto = require('crypto');
const generateId = require('../utils/generateId');

const REFRESH_COOKIE_NAME = 'vaultix_refresh';

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const getActiveSessions = async (req, res) => {
  try {
    const where = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)
      ? {}
      : { userId: req.user.id };

    const sessions = await prisma.refreshToken.findMany({
      where: {
        ...where,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const currentCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    const currentTokenHash = currentCookie ? hashRefreshToken(currentCookie) : null;

    const loginActivities = await prisma.loginActivity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const mapped = sessions.map((s) => {
      const ua = s.userAgent || '';
      let device = 'Unknown Device';
      let os = 'Unknown OS';
      let browser = 'Unknown Browser';

      if (/Windows/i.test(ua)) os = 'Windows';
      else if (/Mac OS/i.test(ua)) os = 'macOS';
      else if (/Linux/i.test(ua)) os = 'Linux';
      else if (/Android/i.test(ua)) os = 'Android';
      else if (/iPhone|iPad/i.test(ua)) os = 'iOS';

      if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
      else if (/Firefox/i.test(ua)) browser = 'Firefox';
      else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
      else if (/Edg/i.test(ua)) browser = 'Edge';

      if (/Mobile/i.test(ua) || /Android/i.test(ua) || /iPhone/i.test(ua)) {
        device = 'Mobile';
      } else if (/iPad|Tablet/i.test(ua)) {
        device = 'Tablet';
      } else {
        device = 'Desktop';
      }

      const loginActivity = loginActivities.find(
        (la) => la.user?.id === s.userId && la.createdAt <= s.createdAt
      );

      return {
        id: s.id,
        userId: s.userId,
        user: s.user,
        ipAddress: s.ipAddress || loginActivity?.ipAddress || 'Unknown',
        userAgent: ua,
        device,
        os,
        browser,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: currentTokenHash ? s.tokenHash === currentTokenHash : false,
      };
    });

    res.json({ sessions: mapped });
  } catch (error) {
    console.error('Session list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.refreshToken.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role) && session.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to revoke this session' });
    }

    await prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        id: await generateId('activityLog'),
        userId: req.user.id,
        action: 'REVOKE_SESSION',
        targetType: 'Session',
        targetId: sessionId,
        metadata: {
          targetUserId: session.userId,
          revokedSessionId: sessionId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
        },
      },
    });

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Session revoke error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const revokeAllSessions = async (req, res) => {
  try {
    const currentCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    const currentTokenHash = currentCookie ? hashRefreshToken(currentCookie) : null;

    // Non-admins revoke only their own sessions (except the current one).
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      const where = { userId: req.user.id, revokedAt: null };
      if (currentTokenHash) where.tokenHash = { not: currentTokenHash };
      await prisma.refreshToken.updateMany({
        where,
        data: { revokedAt: new Date() },
      });
      return res.json({ message: 'All other sessions revoked successfully' });
    }

    // Admins revoke every session except their own current session.
    if (currentTokenHash) {
      await prisma.refreshToken.updateMany({
        where: { revokedAt: null, tokenHash: { not: currentTokenHash } },
        data: { revokedAt: new Date() },
      });
    } else {
      await prisma.refreshToken.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    res.json({ message: 'All other sessions revoked successfully' });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getActiveSessions, revokeSession, revokeAllSessions };
