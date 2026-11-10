import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import MobileAppShell from './layout/MobileAppShell';
import MobileAuthScreen from './screens/MobileAuthScreen';
import MobileHomeScreen from './screens/MobileHomeScreen';
import MobileVaultsScreen from './screens/MobileVaultsScreen';
import MobileItemDetailSheet from './screens/MobileItemDetailSheet';
import MobileGeneratorScreen from './screens/MobileGeneratorScreen';
import MobileHealthScreen from './screens/MobileHealthScreen';
import MobileSettingsScreen from './screens/MobileSettingsScreen';
import AddPasswordModal from '../components/vault/AddPasswordModal';
import EditPasswordModal from '../components/vault/EditPasswordModal';
import {
  logoutUser,
  setMasterVerified,
  setSessionMasterPassword,
  setSessionRsaPublicKey,
} from '../features/auth/authSlice';
import {
  fetchPasswordsByVault,
  fetchVaults,
  openAddPasswordModal,
  openEditPasswordModal,
  deletePassword,
} from '../features/vault/vaultSlice';
import { fetchSecuritySummary } from '../features/dashboard/dashboardSlice';
import {
  verifyMasterPassword,
} from '../utils/verifyMasterPassword';
import {
  decryptPrivateKey,
  unwrapItemKey,
  decryptTextWithAesKey,
  decryptText,
  MASTER_VERIFIER_STORAGE_KEY,
  isEncryptedFormat,
} from '../utils/crypto';
import { persistEncryptedSession } from '../utils/secureSession';
import { secureCopyText } from '../utils/clipboard';
import { hapticSuccess, hapticMedium } from '../utils/haptics';
import api from '../services/api';

export default function MobileRoot() {
  const dispatch = useDispatch();

  const {
    user,
    token,
    isAuthenticated,
    isMasterVerified,
    sessionMasterPassword,
    sessionRsaPrivateKey,
  } = useSelector((state) => state.auth);

  const {
    passwords = [],
    vaults = [],
    isAddPasswordModalOpen,
    isEditPasswordModalOpen,
  } = useSelector((state) => state.vault);

  const { securitySummary } = useSelector((state) => state.dashboard);

  const [activeTab, setActiveTab] = useState('home');
  const [selectedItem, setSelectedItem] = useState(null);
  const [decryptedPassword, setDecryptedPassword] = useState('');
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  // Fetch initial vaults & passwords once master verified
  useEffect(() => {
    if (isAuthenticated && isMasterVerified && token) {
      dispatch(fetchVaults());
      dispatch(fetchSecuritySummary());
    }
  }, [isAuthenticated, isMasterVerified, token, dispatch]);

  useEffect(() => {
    if (vaults?.length > 0 && isMasterVerified) {
      const defaultVault = vaults.find((v) => v.type === 'COMPANY') || vaults[0];
      if (defaultVault?.id) {
        dispatch(fetchPasswordsByVault(defaultVault.id));
      }
    }
  }, [vaults, isMasterVerified, dispatch]);

  // Master password unlock handler
  const handleMasterUnlock = async (candidatePassword) => {
    try {
      let samples = [];
      if (!sessionStorage.getItem(MASTER_VERIFIER_STORAGE_KEY)) {
        try {
          const ownedRes = await api.get('/passwords/owned', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const owned = ownedRes.data || [];
          samples = owned
            .filter((pw) => isEncryptedFormat(pw.encryptedPassword))
            .map((pw) => pw.encryptedPassword);
        } catch {
          samples = [];
        }
      }

      const verified = await verifyMasterPassword(
        candidatePassword,
        user?.encryptionSalt,
        { samples }
      );

      if (!verified) return false;

      dispatch(setMasterVerified(true));
      dispatch(setSessionMasterPassword(candidatePassword));

      try {
        const kpRes = await api.get('/keypair', {
          headers: { Authorization: `Bearer ${token}` },
        });
        let privKey = null;
        let pubKey = null;
        if (kpRes.data?.encryptedPrivateKey) {
          privKey = await decryptPrivateKey(
            kpRes.data.encryptedPrivateKey,
            candidatePassword,
            kpRes.data.salt
          );
          dispatch({ type: 'auth/setSessionRsaPrivateKey', payload: privKey });
          if (kpRes.data.publicKey) {
            pubKey = kpRes.data.publicKey;
            dispatch(setSessionRsaPublicKey(pubKey));
          }
        }
        await persistEncryptedSession(candidatePassword, privKey, pubKey);
      } catch (err) {
        console.warn('Keypair decryption warning:', err);
      }

      showToast('Vault Unlocked');
      return true;
    } catch {
      return false;
    }
  };

  const handleLogout = () => {
    dispatch(setMasterVerified(false));
    dispatch(logoutUser());
  };

  const handleLockVault = () => {
    dispatch(setMasterVerified(false));
    dispatch({ type: 'auth/clearSessionKeys' });
    showToast('Vault Locked');
  };

  // Decrypt password on item select
  const handleOpenItem = async (item) => {
    setSelectedItem(item);
    setDecryptedPassword('');

    if (!item?.encryptedPassword) return;

    try {
      if (item.myWrappedKey && sessionRsaPrivateKey) {
        const aesKeyJwk = await unwrapItemKey(item.myWrappedKey, sessionRsaPrivateKey);
        const original = await decryptTextWithAesKey(item.encryptedPassword, aesKeyJwk);
        setDecryptedPassword(original);
        return;
      }
    } catch {
      // fallback to master password
    }

    try {
      if (sessionMasterPassword) {
        const original = await decryptText(item.encryptedPassword, sessionMasterPassword);
        setDecryptedPassword(original);
      }
    } catch {
      setDecryptedPassword('');
    }
  };

  // Quick copy from item list
  const handleQuickCopy = async (item) => {
    if (!item?.encryptedPassword) {
      if (item?.login) {
        secureCopyText(item.login, 'Username');
        showToast('Username Copied');
      }
      return;
    }

    try {
      let pwd = '';
      if (item.myWrappedKey && sessionRsaPrivateKey) {
        const aesKeyJwk = await unwrapItemKey(item.myWrappedKey, sessionRsaPrivateKey);
        pwd = await decryptTextWithAesKey(item.encryptedPassword, aesKeyJwk);
      } else if (sessionMasterPassword) {
        pwd = await decryptText(item.encryptedPassword, sessionMasterPassword);
      }

      if (pwd) {
        secureCopyText(pwd, 'Password');
        showToast(`Copied ${item.name} password`);
      }
    } catch {
      showToast('Could not decrypt password');
    }
  };

  // If user is not yet master verified, show dedicated mobile unlock screen
  if (!isAuthenticated || !isMasterVerified) {
    return (
      <MobileAuthScreen
        user={user}
        onUnlock={handleMasterUnlock}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <MobileAppShell
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setActiveTab(tab);
        setSelectedItem(null);
      }}
      toast={toast}
    >
      {/* Tab 1: Home Screen */}
      {activeTab === 'home' && (
        <MobileHomeScreen
          user={user}
          summary={securitySummary}
          passwords={passwords}
          onOpenItem={handleOpenItem}
          onNavigateTab={setActiveTab}
          onLockVault={handleLockVault}
          onAddNewItem={() => dispatch(openAddPasswordModal())}
          onRefresh={() => {
            dispatch(fetchVaults());
            dispatch(fetchSecuritySummary());
            showToast('Vault Synchronized');
          }}
        />
      )}

      {/* Tab 2: Vaults Screen */}
      {activeTab === 'vaults' && (
        <MobileVaultsScreen
          passwords={passwords}
          onOpenItem={handleOpenItem}
          onAddNewItem={() => dispatch(openAddPasswordModal())}
          onQuickCopy={handleQuickCopy}
        />
      )}

      {/* Tab 3: Dedicated Password Generator Screen */}
      {activeTab === 'generator' && (
        <MobileGeneratorScreen
          onCopyPassword={(pwd) => {
            secureCopyText(pwd, 'Password');
            showToast('Password Copied');
          }}
        />
      )}

      {/* Tab 4: Health Audit Screen */}
      {activeTab === 'health' && (
        <MobileHealthScreen
          summary={securitySummary}
          onFixWithGenerator={() => setActiveTab('generator')}
          onOpenVaults={() => setActiveTab('vaults')}
        />
      )}

      {/* Tab 5: Settings Screen */}
      {activeTab === 'settings' && (
        <MobileSettingsScreen
          user={user}
          onLockAndLogout={handleLogout}
        />
      )}

      {/* Item Detail Bottom Sheet */}
      {selectedItem && (
        <MobileItemDetailSheet
          item={selectedItem}
          decryptedPassword={decryptedPassword}
          onClose={() => setSelectedItem(null)}
          onCopyText={(text, label) => {
            secureCopyText(text, label);
            showToast(`${label} Copied`);
          }}
          onEdit={() => {
            setSelectedItem(null);
            dispatch(openEditPasswordModal());
          }}
          onDelete={async (item) => {
            if (window.confirm(`Move "${item.name}" to Trash?`)) {
              await dispatch(deletePassword(item.id));
              setSelectedItem(null);
              showToast(`Moved "${item.name}" to Trash`);
            }
          }}
        />
      )}

      {/* Modals when triggered from Mobile */}
      {isAddPasswordModalOpen && <AddPasswordModal />}
      {isEditPasswordModalOpen && <EditPasswordModal />}
    </MobileAppShell>
  );
}
