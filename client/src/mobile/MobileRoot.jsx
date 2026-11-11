import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import MobileAppShell from './layout/MobileAppShell';
import MobileAuthScreen from './screens/MobileAuthScreen';
import MobileHomeScreen from './screens/MobileHomeScreen';
import MobileVaultsScreen from './screens/MobileVaultsScreen';
import MobileItemDetailSheet from './screens/MobileItemDetailSheet';
import MobileItemEditorSheet from './screens/MobileItemEditorSheet';
import MobileFolderManagerSheet from './screens/MobileFolderManagerSheet';
import MobileTrashSheet from './screens/MobileTrashSheet';
import MobileShareSheet from './screens/MobileShareSheet';
import MobileSharedWithMeSheet from './screens/MobileSharedWithMeSheet';
import MobileNotificationsSheet from './screens/MobileNotificationsSheet';
import MobileTwoFactorSheet from './screens/MobileTwoFactorSheet';
import MobileSessionsSheet from './screens/MobileSessionsSheet';
import MobileActivityLogSheet from './screens/MobileActivityLogSheet';
import MobileTeamSheet from './screens/MobileTeamSheet';
import MobileApprovalsSheet from './screens/MobileApprovalsSheet';
import MobileDepartmentsSheet from './screens/MobileDepartmentsSheet';
import MobilePoliciesSheet from './screens/MobilePoliciesSheet';
import MobileImportExportSheet from './screens/MobileImportExportSheet';
import MobileProfileSheet from './screens/MobileProfileSheet';
import MobileGeneratorScreen from './screens/MobileGeneratorScreen';
import MobileHealthScreen from './screens/MobileHealthScreen';
import MobileSettingsScreen from './screens/MobileSettingsScreen';
import {
  logoutUser,
  loginUser,
  registerUser,
  setMasterVerified,
  setSessionMasterPassword,
  setSessionRsaPublicKey,
} from '../features/auth/authSlice';
import {
  fetchPasswordsByVault,
  fetchVaults,
  fetchVaultBySlug,
  fetchFoldersByVault,
  deletePassword,
} from '../features/vault/vaultSlice';
import { fetchSecuritySummary } from '../features/dashboard/dashboardSlice';
import { verifyMasterPassword } from '../utils/verifyMasterPassword';
import {
  decryptPrivateKey,
  unwrapItemKey,
  decryptTextWithAesKey,
  decryptFieldsWithAesKey,
  decryptText,
  decryptFields,
  MASTER_VERIFIER_STORAGE_KEY,
  isEncryptedFormat,
} from '../utils/crypto';
import { persistEncryptedSession } from '../utils/secureSession';
import { secureCopyText } from '../utils/clipboard';
import { hapticSuccess, hapticMedium, hapticLight } from '../utils/haptics';
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
    selectedVault,
    folders = [],
  } = useSelector((state) => state.vault);

  const { securitySummary } = useSelector((state) => state.dashboard);

  // Tab State
  const [activeTab, setActiveTab] = useState('home');

  // Sheet States
  const [selectedItem, setSelectedItem] = useState(null);
  const [decryptedPassword, setDecryptedPassword] = useState('');
  const [decryptedNote, setDecryptedNote] = useState('');
  const [decryptedFields, setDecryptedFields] = useState({});
  const [toast, setToast] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  // Item Editor State (Create & Edit)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [editingItem, setEditingItem] = useState(null);

  // Folders & Trash Sheets
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Sharing & Notifications Sheets
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [sharingItem, setSharingItem] = useState(null);
  const [isSharedWithMeOpen, setIsSharedWithMeOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Security & Enterprise Sheets
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [isActivityLogsOpen, setIsActivityLogsOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false);
  const [isDepartmentsOpen, setIsDepartmentsOpen] = useState(false);
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }, []);

  const fetchUnreadNotifications = useCallback(async () => {
    try {
      let raw = null;
      try {
        const resActivity = await api.get('/notifications/recent-activity');
        raw = resActivity?.data;
      } catch {
        const resNotif = await api.get('/notifications');
        raw = resNotif?.data;
      }
      const count =
        typeof raw?.unreadCount === 'number'
          ? raw.unreadCount
          : Array.isArray(raw?.items)
          ? raw.items.filter((i) => i && !i.isRead).length
          : Array.isArray(raw?.notifications)
          ? raw.notifications.filter((n) => n && !n.isRead).length
          : 0;
      setUnreadCount(count);
    } catch {
      // ignore
    }
  }, []);

  // Fetch initial vaults, summary, & notifications once master verified
  useEffect(() => {
    if (isAuthenticated && isMasterVerified && token) {
      dispatch(fetchVaults());
      dispatch(fetchSecuritySummary());
      fetchUnreadNotifications();
      window.addEventListener('vaultix:notifications-updated', fetchUnreadNotifications);
      return () => window.removeEventListener('vaultix:notifications-updated', fetchUnreadNotifications);
    }
  }, [isAuthenticated, isMasterVerified, token, dispatch, fetchUnreadNotifications]);

  // Select default vault and fetch its items & folders
  useEffect(() => {
    if (vaults?.length > 0 && isMasterVerified) {
      const targetVault = selectedVault || vaults.find((v) => v.type === 'COMPANY') || vaults[0];
      if (targetVault?.id) {
        if (!selectedVault || selectedVault.id !== targetVault.id) {
          if (targetVault.slug) {
            dispatch(fetchVaultBySlug(targetVault.slug));
          }
        }
        dispatch(fetchPasswordsByVault(targetVault.id));
        dispatch(fetchFoldersByVault(targetVault.id));
      }
    }
  }, [vaults, isMasterVerified, dispatch]);

  // Handle switching vaults
  const handleSelectVault = (vault) => {
    if (!vault?.id) return;
    if (vault.slug) {
      dispatch(fetchVaultBySlug(vault.slug));
    }
    dispatch(fetchPasswordsByVault(vault.id));
    dispatch(fetchFoldersByVault(vault.id));
    showToast(`Switched to ${vault.name}`);
  };

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

  // Decrypt password, notes, and typed fields on item select
  const handleOpenItem = async (item) => {
    setSelectedItem(item);
    setDecryptedPassword('');
    setDecryptedNote('');
    setDecryptedFields({});

    if (!item) return;

    try {
      let pwd = '';
      let nt = '';
      let flds = {};

      if (item.myWrappedKey && sessionRsaPrivateKey) {
        const aesKeyJwk = await unwrapItemKey(item.myWrappedKey, sessionRsaPrivateKey);
        if (item.encryptedPassword) {
          pwd = await decryptTextWithAesKey(item.encryptedPassword, aesKeyJwk);
        }
        if (item.encryptedNote) {
          nt = await decryptTextWithAesKey(item.encryptedNote, aesKeyJwk);
        }
        if (item.encryptedFields) {
          flds = await decryptFieldsWithAesKey(item.encryptedFields, aesKeyJwk);
        }
      } else if (sessionMasterPassword) {
        if (item.encryptedPassword) {
          pwd = await decryptText(item.encryptedPassword, sessionMasterPassword, user?.encryptionSalt);
        }
        if (item.encryptedNote) {
          nt = await decryptText(item.encryptedNote, sessionMasterPassword, user?.encryptionSalt);
        }
        if (item.encryptedFields) {
          flds = await decryptFields(item.encryptedFields, sessionMasterPassword, user?.encryptionSalt);
        }
      }

      setDecryptedPassword(pwd || item.password || '');
      setDecryptedNote(nt || item.note || item.notes || '');
      setDecryptedFields(flds || item.fields || {});
    } catch (err) {
      console.warn('handleOpenItem decryption error:', err);
      setDecryptedPassword(item.password || '');
      setDecryptedNote(item.note || item.notes || '');
      setDecryptedFields(item.fields || {});
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
        pwd = await decryptText(item.encryptedPassword, sessionMasterPassword, user?.encryptionSalt);
      }

      if (pwd) {
        secureCopyText(pwd, 'Password');
        showToast(`Copied ${item.name} password`);
      }
    } catch {
      showToast('Could not decrypt password');
    }
  };

  // Modal Triggers
  const handleOpenCreateItem = () => {
    hapticMedium();
    setEditingItem(null);
    setEditorMode('create');
    setIsEditorOpen(true);
  };

  const handleOpenEditItem = (item, pwd, nt, flds) => {
    hapticMedium();
    const resolvedPwd = pwd !== undefined ? pwd : decryptedPassword;
    const resolvedNt = nt !== undefined ? nt : decryptedNote;
    const resolvedFlds = flds !== undefined ? flds : decryptedFields;

    setEditingItem({
      ...item,
      decryptedPassword: resolvedPwd,
      decryptedNote: resolvedNt,
      decryptedFields: resolvedFlds,
    });
    setEditorMode('edit');
    setSelectedItem(null);
    setIsEditorOpen(true);
  };

  const handleOpenShareItem = (item) => {
    hapticMedium();
    setSharingItem(item);
    setIsShareOpen(true);
  };

  // If user is not yet master verified, show dedicated mobile auth / unlock screen
  if (!isAuthenticated || !isMasterVerified) {
    return (
      <MobileAuthScreen
        user={user}
        isAuthenticated={isAuthenticated}
        onLogin={async (credentials) => {
          const action = await dispatch(loginUser(credentials));
          if (loginUser.fulfilled.match(action)) {
            if (action.payload?.require2FA) {
              return { require2FA: true, twoFactorMethod: action.payload.twoFactorMethod };
            }
            return { success: true };
          }
          return { error: action.payload || 'Login failed' };
        }}
        onRegister={async (formData) => {
          const action = await dispatch(registerUser(formData));
          if (registerUser.fulfilled.match(action)) {
            return { success: true };
          }
          return { error: action.payload || 'Registration failed' };
        }}
        onUnlockMaster={handleMasterUnlock}
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
          unreadCount={unreadCount}
          onOpenItem={handleOpenItem}
          onNavigateTab={setActiveTab}
          onLockVault={handleLockVault}
          onAddNewItem={handleOpenCreateItem}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenSharedWithMe={() => setIsSharedWithMeOpen(true)}
          onOpenImportExport={() => setIsImportExportOpen(true)}
          onRefresh={() => {
            dispatch(fetchVaults());
            dispatch(fetchSecuritySummary());
            fetchUnreadNotifications();
            if (selectedVault?.id) {
              dispatch(fetchPasswordsByVault(selectedVault.id));
              dispatch(fetchFoldersByVault(selectedVault.id));
            }
            showToast('Vault Synchronized');
          }}
        />
      )}

      {/* Tab 2: Vaults Screen */}
      {activeTab === 'vaults' && (
        <MobileVaultsScreen
          passwords={passwords}
          folders={folders}
          vaults={vaults}
          selectedVault={selectedVault}
          unreadCount={unreadCount}
          onSelectVault={handleSelectVault}
          onOpenItem={handleOpenItem}
          onAddNewItem={handleOpenCreateItem}
          onQuickCopy={handleQuickCopy}
          onOpenFolderManager={() => setIsFolderManagerOpen(true)}
          onOpenTrash={() => setIsTrashOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenSharedWithMe={() => setIsSharedWithMeOpen(true)}
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
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenTwoFactor={() => setIsTwoFactorOpen(true)}
          onOpenSessions={() => setIsSessionsOpen(true)}
          onOpenActivityLogs={() => setIsActivityLogsOpen(true)}
          onOpenTeam={() => setIsTeamOpen(true)}
          onOpenApprovals={() => setIsApprovalsOpen(true)}
          onOpenDepartments={() => setIsDepartmentsOpen(true)}
          onOpenPolicies={() => setIsPoliciesOpen(true)}
          onOpenImportExport={() => setIsImportExportOpen(true)}
        />
      )}

      {/* Detail Sheet */}
      {selectedItem && (
        <MobileItemDetailSheet
          item={selectedItem}
          decryptedPassword={decryptedPassword}
          decryptedNote={decryptedNote}
          decryptedFields={decryptedFields}
          onClose={() => setSelectedItem(null)}
          onCopyText={(text, label) => {
            secureCopyText(text, label);
            showToast(`${label} Copied`);
          }}
          onEdit={(item, pwd, nt, flds) => handleOpenEditItem(item, pwd, nt, flds)}
          onShare={(item) => handleOpenShareItem(item)}
          onDelete={async (item) => {
            if (window.confirm(`Move "${item.name}" to Trash?`)) {
              await dispatch(deletePassword(item.id));
              setSelectedItem(null);
              showToast(`Moved "${item.name}" to Trash`);
              if (selectedVault?.id) {
                dispatch(fetchPasswordsByVault(selectedVault.id));
              }
            }
          }}
        />
      )}

      {/* Item Editor Sheet (Create / Edit all 4 item types) */}
      <MobileItemEditorSheet
        isOpen={isEditorOpen}
        mode={editorMode}
        item={editingItem}
        initialDecryptedPassword={editingItem?.decryptedPassword || ''}
        initialDecryptedNote={editingItem?.decryptedNote || ''}
        initialDecryptedFields={editingItem?.decryptedFields || {}}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingItem(null);
        }}
        onSaved={() => {
          setIsEditorOpen(false);
          setEditingItem(null);
          showToast(editorMode === 'create' ? 'Item Created' : 'Item Updated');
          if (selectedVault?.id) {
            dispatch(fetchPasswordsByVault(selectedVault.id));
          }
        }}
      />

      {/* Folder Manager Sheet */}
      <MobileFolderManagerSheet
        isOpen={isFolderManagerOpen}
        onClose={() => setIsFolderManagerOpen(false)}
      />

      {/* Trash Recovery Sheet */}
      <MobileTrashSheet
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
      />

      {/* Share Credential Sheet */}
      <MobileShareSheet
        isOpen={isShareOpen}
        item={sharingItem}
        onClose={() => {
          setIsShareOpen(false);
          setSharingItem(null);
        }}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* Shared With Me Sheet */}
      <MobileSharedWithMeSheet
        isOpen={isSharedWithMeOpen}
        onClose={() => setIsSharedWithMeOpen(false)}
      />

      {/* Notifications Sheet */}
      <MobileNotificationsSheet
        isOpen={isNotificationsOpen}
        onClose={() => {
          setIsNotificationsOpen(false);
          fetchUnreadNotifications();
        }}
      />

      {/* Two-Factor Authentication Sheet */}
      <MobileTwoFactorSheet
        isOpen={isTwoFactorOpen}
        onClose={() => setIsTwoFactorOpen(false)}
      />

      {/* Active Sessions Sheet */}
      <MobileSessionsSheet
        isOpen={isSessionsOpen}
        onClose={() => setIsSessionsOpen(false)}
      />

      {/* Audit Activity Log Sheet */}
      <MobileActivityLogSheet
        isOpen={isActivityLogsOpen}
        onClose={() => setIsActivityLogsOpen(false)}
      />

      {/* Team Management Sheet */}
      <MobileTeamSheet
        isOpen={isTeamOpen}
        onClose={() => setIsTeamOpen(false)}
      />

      {/* Admin Approvals Sheet */}
      <MobileApprovalsSheet
        isOpen={isApprovalsOpen}
        onClose={() => setIsApprovalsOpen(false)}
      />

      {/* Departments Sheet */}
      <MobileDepartmentsSheet
        isOpen={isDepartmentsOpen}
        onClose={() => setIsDepartmentsOpen(false)}
      />

      {/* Organization Security Policies Sheet */}
      <MobilePoliciesSheet
        isOpen={isPoliciesOpen}
        onClose={() => setIsPoliciesOpen(false)}
      />

      {/* Vault Import & Export Sheet */}
      <MobileImportExportSheet
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
      />

      {/* Profile & Credentials Security Sheet */}
      <MobileProfileSheet
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </MobileAppShell>
  );
}
