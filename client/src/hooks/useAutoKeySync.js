import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { unwrapItemKey } from '../utils/crypto';
import { wrapItemKeysForUsers, clearKeyWrappingCaches } from '../utils/keyWrapping';

// Cooldown between background auto-sync checks (60 seconds)
const SYNC_COOLDOWN_MS = 60 * 1000;

export default function useAutoKeySync() {
  const { token, user, sessionRsaPrivateKey } = useSelector((state) => state.auth);
  const isSyncingRef = useRef(false);
  const lastSyncTimeRef = useRef(0);

  useEffect(() => {
    // Only run if user is logged in, vault is unlocked (private key in RAM),
    // and user has an administrative role capable of wrapping keys for team members.
    if (!token || !user || !sessionRsaPrivateKey) return;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return;

    let cancelled = false;

    const runAutoKeySync = async () => {
      const now = Date.now();
      if (isSyncingRef.current || now - lastSyncTimeRef.current < SYNC_COOLDOWN_MS) {
        return;
      }

      isSyncingRef.current = true;

      try {
        // 1. Fetch company / shared vaults
        const vaultsRes = await api.get('/vaults', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const companyVaults = (vaultsRes.data || []).filter((v) => v.type !== 'PERSONAL');

        for (const vault of companyVaults) {
          if (cancelled) break;

          // 2. Query items needing wrapping in this vault
          const itemsRes = await api.get(`/passwords/vault/${vault.id}/items-needing-wrap`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const itemsNeedingWrap = itemsRes.data || [];
          if (itemsNeedingWrap.length === 0) continue;

          clearKeyWrappingCaches();
          const updates = [];

          for (const item of itemsNeedingWrap) {
            if (cancelled) break;
            if (!item.myWrappedKey || !item.missingUserIds?.length) continue;

            try {
              const aesKeyJwk = await unwrapItemKey(item.myWrappedKey, sessionRsaPrivateKey);
              const additions = await wrapItemKeysForUsers(aesKeyJwk, item.missingUserIds);

              if (Object.keys(additions).length > 0) {
                updates.push({ id: item.id, wrappedKeys: additions });
              }
            } catch {
              // skip item if unwrap fails
            }

            // Yield thread for smooth UI responsiveness
            await new Promise((r) => setTimeout(r, 40));
          }

          if (updates.length > 0 && !cancelled) {
            await api.post(
              '/passwords/batch-wrap',
              { wrappedPasswords: updates },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`[AutoKeySync] Silently synced encryption keys for ${updates.length} items in vault "${vault.name}"`);
          }
        }

        lastSyncTimeRef.current = Date.now();
      } catch (err) {
        // Silent background catch - do not disrupt user
        console.debug('[AutoKeySync] Background check error:', err?.message);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Run 2.5 seconds after vault unlock
    const timerId = setTimeout(() => {
      runAutoKeySync();
    }, 2500);

    // Also run periodically every 2 minutes while active
    const intervalId = setInterval(() => {
      runAutoKeySync();
    }, 120 * 1000);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      clearInterval(intervalId);
    };
  }, [token, user, sessionRsaPrivateKey]);
}
