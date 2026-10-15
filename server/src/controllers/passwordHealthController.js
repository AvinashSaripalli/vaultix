const prisma = require('../config/prisma');

const OLD_DAYS_THRESHOLD = 180;

const BREACHED_PASSWORDS = new Set([
  '123456', 'password', '12345678', 'qwerty', '123456789',
  '12345', '1234', '111111', '1234567', 'sunshine',
  'qwerty123', 'iloveyou', 'princess', 'admin', 'welcome',
  '666666', 'abc123', 'football', '123123', 'monkey',
  '654321', '!@#$%^&*', 'charlie', 'aaaaaa', 'donald',
  'dragon', '1234567890', 'michael', 'baseball', 'ashley',
  'letmein', 'shadow', 'master', '121212', 'flower',
  'hottie', 'login', 'passw0rd', 'starwars', 'ninja',
  'mustang', 'qwerty12345', 'batman', 'trustno1', 'access',
  'passwd', 'lovely', 'superman', 'killer', 'hunter',
  '123qwe', 'zaq12wsx', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  '1q2w3e4r', 'qazwsx', 'password1', 'password123', 'changeme',
  'default', 'administrator', 'root', 'toor', 'guest',
  'test', 'testing', 'temp', 'temporary',
  '000000', '00000000', '012345', '0123456', '01234567',
  '102030', '112233', '123321', '131313', '232323',
  '555555', '777777', '888888', '999999', '696969',
  'loveme', 'fuckme', 'fuckyou', 'sexy', 'sexy123',
  'pass', 'pass123', 'pass1234', 'p@ssword', 'p@ssw0rd',
  'qwerty1', 'qwerty12', 'qwerty1234', 'asdf', 'asdfgh',
  'zxcvbn', 'qwertz', '123456a', '123456b', 'a123456',
  '1qaz2wsx', '3edc4rfv', '123qweasd', 'qweasd', 'qwe123',
  'passwrd', 'passwerd', 'pasword', 'pasvord',
]);

const getPasswordHealth = async (req, res) => {
  try {
    const where = ['OWNER', 'ADMIN'].includes(req.user.role)
      ? { vault: { type: 'COMPANY' }, deletedAt: null }
      : { vault: { ownerId: req.user.id, type: 'PERSONAL' }, deletedAt: null };

    const passwords = await prisma.passwordEntry.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        login: true,
        url: true,
        isWeak: true,
        isOld: true,
        isAtRisk: true,
        isSensitive: true,
        strengthScore: true,
        createdAt: true,
        updatedAt: true,
        lastUpdatedAt: true,
        vault: { select: { id: true, name: true } },
      },
    });

    const loginPasswords = passwords.filter((p) => !p.type || p.type === 'LOGIN');
    const total = loginPasswords.length;

    const isEntryOld = (p) => {
      if (p.isOld) return true;
      const d = new Date(p.lastUpdatedAt || p.updatedAt || p.createdAt);
      const ageDays = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
      return ageDays >= OLD_DAYS_THRESHOLD;
    };

    const weak = loginPasswords.filter((p) => p.isWeak);
    const old = loginPasswords.filter(isEntryOld);
    const atRisk = loginPasswords.filter((p) => p.isAtRisk);
    const sensitive = passwords.filter((p) => p.isSensitive);

    const strengthDistribution = {
      weak: loginPasswords.filter((p) => (p.strengthScore ?? 0) <= 2).length,
      medium: loginPasswords.filter((p) => (p.strengthScore ?? 0) > 2 && (p.strengthScore ?? 0) <= 4).length,
      strong: loginPasswords.filter((p) => (p.strengthScore ?? 0) > 4).length,
      unknown: loginPasswords.filter((p) => p.strengthScore == null).length,
    };

    const ageDistribution = {
      fresh: loginPasswords.filter((p) => {
        const d = new Date(p.lastUpdatedAt || p.updatedAt || p.createdAt);
        return (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
      }).length,
      months3: loginPasswords.filter((p) => {
        const d = new Date(p.lastUpdatedAt || p.updatedAt || p.createdAt);
        const age = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
        return age >= 30 && age < 90;
      }).length,
      months6: loginPasswords.filter((p) => {
        const d = new Date(p.lastUpdatedAt || p.updatedAt || p.createdAt);
        const age = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
        return age >= 90 && age < OLD_DAYS_THRESHOLD;
      }).length,
      over6m: old.length,
    };

    const recommendations = [];
    if (weak.length > 0) {
      recommendations.push({
        type: 'weak',
        severity: 'high',
        title: `${weak.length} weak password${weak.length > 1 ? 's' : ''} detected`,
        description: 'Weak passwords can be easily guessed or cracked. Consider updating them with stronger alternatives.',
        count: weak.length,
      });
    }
    if (old.length > 0) {
      recommendations.push({
        type: 'old',
        severity: 'medium',
        title: `${old.length} password${old.length > 1 ? 's' : ''} older than 6 months`,
        description: 'Regularly rotating passwords reduces the risk of compromised credentials going undetected.',
        count: old.length,
      });
    }
    if (atRisk.length > 0) {
      recommendations.push({
        type: 'at_risk',
        severity: 'critical',
        title: `${atRisk.length} password${atRisk.length > 1 ? 's' : ''} at risk of breach`,
        description: 'These passwords appear in known breach databases. Change them immediately.',
        count: atRisk.length,
      });
    }
    if (sensitive.length > 0) {
      recommendations.push({
        type: 'sensitive',
        severity: 'low',
        title: `${sensitive.length} sensitive item${sensitive.length > 1 ? 's' : ''} in vault`,
        description: 'Ensure sensitive items have appropriate access controls and are regularly reviewed.',
        count: sensitive.length,
      });
    }

    if (strengthDistribution.weak > 0) {
      recommendations.push({
        type: 'strength',
        severity: 'high',
        title: 'Use the password generator',
        description: 'Generate strong, unique passwords for all your accounts using the built-in password generator.',
        count: strengthDistribution.weak,
      });
    }

    const securityScore = total === 0 ? 100 : Math.max(0, Math.round(
      100
      - (weak.length / total) * 40
      - (old.length / total) * 25
      - (atRisk.length / total) * 35
    ));

    res.json({
      total,
      securityScore,
      weakCount: weak.length,
      oldCount: old.length,
      atRiskCount: atRisk.length,
      sensitiveCount: sensitive.length,
      strengthDistribution,
      ageDistribution,
      weakPasswords: weak.map((p) => ({
        id: p.id,
        name: p.name,
        login: p.login,
        url: p.url,
        strengthScore: p.strengthScore,
        vault: p.vault,
      })),
      oldPasswords: old.map((p) => ({
        id: p.id,
        name: p.name,
        login: p.login,
        url: p.url,
        createdAt: p.createdAt,
        updatedAt: p.lastUpdatedAt || p.updatedAt,
        vault: p.vault,
      })),
      atRiskPasswords: atRisk.map((p) => ({
        id: p.id,
        name: p.name,
        login: p.login,
        url: p.url,
        vault: p.vault,
      })),
      recommendations,
    });
  } catch (error) {
    console.error('Password health error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getPasswordHealth };
