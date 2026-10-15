const prisma = require('../config/prisma');

const DEFAULT_POLICY = {
  id: 'default',
  requireTwoFactor: false,
  maxVaultTimeoutMinutes: null,
  minMasterPasswordLength: 8,
  requireMasterPasswordSpecial: true,
  clipboardTimeoutSeconds: null,
};

let cachedPolicy = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10s memory cache to avoid pounding the DB on every request

const getEffectiveOrganizationPolicy = async () => {
  const now = Date.now();
  if (cachedPolicy && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedPolicy;
  }

  try {
    const policy = await prisma.organizationPolicy.findUnique({
      where: { id: 'default' },
    });

    cachedPolicy = policy || DEFAULT_POLICY;
    lastCacheTime = now;
    return cachedPolicy;
  } catch (error) {
    console.error('Fetch organization policy error:', error);
    return cachedPolicy || DEFAULT_POLICY;
  }
};

const invalidatePolicyCache = () => {
  cachedPolicy = null;
  lastCacheTime = 0;
};

module.exports = {
  getEffectiveOrganizationPolicy,
  invalidatePolicyCache,
  DEFAULT_POLICY,
};
