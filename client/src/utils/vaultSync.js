/**
 * Vaultix Smart Real-Time Synchronization Engine
 * Bridges in-memory component caches, multi-tab broadcasts, and the Chrome extension.
 */

let broadcastChannel = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('vaultix_sync_channel');
  }
} catch {
  // BroadcastChannel not available in environment
}

/**
 * Notifies the current window, open browser tabs, and the Chrome Extension
 * that a vault item was created, updated, or deleted.
 *
 * @param {Object} detail - { id, action: 'UPDATE' | 'CREATE' | 'DELETE', password, note, fields }
 */
export function notifyVaultMutated(detail = {}) {
  if (typeof window === 'undefined') return;

  // 1. In-page event for active components (e.g. PasswordDetailsPanel, ItemDetailsPanel)
  try {
    window.dispatchEvent(new CustomEvent('vaultix:item-updated', { detail }));
  } catch (err) {
    console.warn('In-page sync dispatch failed:', err);
  }

  // 2. Direct message for Vaultix Chrome Extension content script
  try {
    window.postMessage({ type: 'VAULTIX_VAULT_MUTATED', detail }, '*');
  } catch (err) {
    console.warn('Extension bridge postMessage failed:', err);
  }

  // 3. Broadcast to other open browser tabs
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'VAULTIX_SYNC_MUTATION', detail, ts: Date.now() });
    }
  } catch (err) {
    console.warn('BroadcastChannel postMessage failed:', err);
  }
}

/**
 * Subscribes a component or page to cross-tab vault mutations.
 *
 * @param {Function} callback - ({ detail, ts }) => void
 * @returns {Function} cleanup function
 */
export function subscribeToVaultMutations(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') {
    return () => {};
  }

  const broadcastHandler = (event) => {
    if (event.data?.type === 'VAULTIX_SYNC_MUTATION') {
      callback(event.data);
    }
  };

  const windowMessageHandler = (event) => {
    if (event.data?.type === 'VAULTIX_VAULT_MUTATED' && event.data?.fromExtension) {
      callback({ detail: event.data.detail, ts: Date.now() });
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', broadcastHandler);
  }
  window.addEventListener('message', windowMessageHandler);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', broadcastHandler);
    }
    window.removeEventListener('message', windowMessageHandler);
  };
}
