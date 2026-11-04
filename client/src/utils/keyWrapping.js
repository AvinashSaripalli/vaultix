import api from '../services/api';
import { wrapItemKey } from './crypto';

const publicKeyCache = {};

export async function getPublicKeyForUser(userId) {
  if (!userId) return null;
  if (publicKeyCache[userId]) return publicKeyCache[userId];

  try {
    const res = await api.get(`/keypair/${userId}/public`);
    const publicKey = res.data?.publicKey || null;
    if (publicKey) publicKeyCache[userId] = publicKey;
    return publicKey;
  } catch {
    return null;
  }
}

const RECIPIENTS_CACHE_TTL_MS = 60 * 1000;
const recipientsCache = {};

export async function getWrapRecipients(folderId, currentUserId, fallbackPermissions = []) {
  const ids = new Set(currentUserId ? [currentUserId] : []);

  if (folderId) {
    const cached = recipientsCache[folderId];
    const isFresh =
      cached && Date.now() - cached.fetchedAt < RECIPIENTS_CACHE_TTL_MS;

    if (isFresh) {
      for (const id of cached.userIds) ids.add(id);
      return [...ids];
    }

    try {
      const res = await api.get(`/folders/${folderId}/wrap-recipients`);
      const userIds = (res.data?.userIds || []).filter(Boolean);

      recipientsCache[folderId] = { userIds, fetchedAt: Date.now() };

      for (const id of userIds) ids.add(id);
      return [...ids];
    } catch {
      // fall through to permission-based fallback
    }
  }

  for (const perm of fallbackPermissions || []) {
    const id = perm?.userId || perm?.user?.id;
    if (id) ids.add(id);
  }

  return [...ids];
}

export function clearKeyWrappingCaches() {
  Object.keys(recipientsCache).forEach((key) => delete recipientsCache[key]);
  Object.keys(publicKeyCache).forEach((key) => delete publicKeyCache[key]);
}

export async function wrapItemKeysForUsers(aesKeyJwk, userIds) {
  const wrappedKeys = {};
  if (!aesKeyJwk) return wrappedKeys;

  for (const userId of userIds) {
    const publicKey = await getPublicKeyForUser(userId);
    if (!publicKey) continue;

    try {
      wrappedKeys[userId] = await wrapItemKey(aesKeyJwk, publicKey);
    } catch {
      // skip users whose key cannot be wrapped
    }
  }

  return wrappedKeys;
}
