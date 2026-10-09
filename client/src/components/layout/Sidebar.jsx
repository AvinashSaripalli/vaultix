import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Shield, Users, Activity, Folder, FolderOpen,
  LogOut, Plus, ChevronDown, LockKeyhole, Share2, User, Sparkles, Building2,
  Smartphone, Clock, HeartPulse, MonitorCheck, Clipboard,
  PanelLeftClose, PanelLeftOpen, X,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../../features/auth/authSlice';
import useLockVault from '../../hooks/useLockVault';
import { useLayout } from '../../context/LayoutContext';
import api from '../../services/api';
import {
  fetchVaults, fetchFoldersByVault, selectFolder, clearSelectedFolder,
  openAddFolderModal, deleteFolder, clearVaultError,
} from '../../features/vault/vaultSlice';
import ShareFolderModal from '../folder/ShareFolderModal';
import RenameFolderModal from '../folder/RenameFolderModal';
import FolderActionsMenu from '../folder/FolderActionsMenu';
import ConfirmModal from '../common/ConfirmModal';
import PasswordGeneratorModal from '../tools/PasswordGeneratorModal';
import { showToast } from '../../utils/toast';
import logo from '../../assets/Vaultix1.png';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { slug: currentVaultSlug } = useParams();

  const { sidebarCollapsed, toggleSidebarCollapse, mobileSidebarOpen, closeMobileSidebar } = useLayout();

  const { user, isMasterVerified } = useSelector((state) => state.auth);
  const { vaults, vaultsLoading, folders, foldersLoading, selectedFolderId, error } =
    useSelector((state) => state.vault);

  const activeVault = vaults.find((v) => v.slug === currentVaultSlug);
  const currentVaultId = activeVault?.id;

  const [shareOpen, setShareOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [actionFolder, setActionFolder] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, folder: null });
  const [unreadCount, setUnreadCount] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => { dispatch(fetchVaults()); }, [dispatch]);

  useEffect(() => {
    if (currentVaultId) dispatch(fetchFoldersByVault(currentVaultId));
  }, [dispatch, currentVaultId]);

  useEffect(() => {
    const fetchUnread = async () => {
      if (!localStorage.getItem('token')) return;
      try {
        const params = {};
        const lastViewed = localStorage.getItem('lastViewedAt');
        if (lastViewed) params.since = lastViewed;
        const res = await api.get('/notifications/recent-activity', { params });
        setUnreadCount(res.data.unreadCount || 0);
      } catch { setUnreadCount(0); }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const overviewMenu = [{ name: 'Security Dashboard', path: '/dashboard', icon: Shield }];
  const vaultMenu = [
    { name: 'Personal Vault', path: '/my-vault', icon: LockKeyhole },
    { name: 'Shared With Me', path: '/shared-with-me', icon: Share2 },
  ];
  const deptMenu = user?.role !== 'ADMIN'
    ? [{ name: 'My Departments', path: '/my-departments', icon: Building2 }]
    : [];
  const securityMenu = [
    { name: 'Activity Log', path: '/activity-log', icon: Activity, badge: unreadCount },
    { name: 'Password Health', path: '/security/password-health', icon: HeartPulse },
  ];
  const settingsMenu = [
    { name: 'Active Sessions', path: '/security/sessions', icon: MonitorCheck },
    { name: 'Two-Factor Auth', path: '/security/2fa', icon: Smartphone },
    { name: 'Vault Timeout', path: '/security/vault-timeout', icon: Clock },
    { name: 'Clipboard', path: '/security/clipboard', icon: Clipboard },
  ];
  const toolsMenu = [{ name: 'Password Generator', icon: Sparkles }];
  const adminMenu = user?.role === 'ADMIN'
    ? [
        { name: 'Team Management', path: '/team-management', icon: Users },
        { name: 'Departments', path: '/departments', icon: Building2 },
      ]
    : [];

  const accountMenu = [{ name: 'Profile', path: '/profile', icon: User }];

  const lockVault = useLockVault();
  const handleLogout = () => { dispatch(logoutUser()); navigate('/login'); };
  const openRename = (folder) => { setActionFolder(folder); setRenameOpen(true); };
  const openShare = (folder) => { setActionFolder(folder); setShareOpen(true); };
  const handleDeleteFolder = (folder) => { dispatch(clearVaultError()); setConfirmDelete({ open: true, folder }); };
  const executeDeleteFolder = async () => {
    if (!confirmDelete.folder) return;
    const result = await dispatch(deleteFolder(confirmDelete.folder.id));
    if (deleteFolder.rejected.match(result)) {
      showToast(result.payload || 'Failed to delete folder', 'error');
    }
    setConfirmDelete({ open: false, folder: null });
  };

  const renderNavSection = (title, items, isCollapsed = false, onNavigate) => {
    if (!items.length) return null;

    if (isCollapsed) {
      return (
        <div className="space-y-1">
          <div className="my-1.5 border-t border-[var(--border-secondary)] mx-1" />
          {items.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={onNavigate}
                title={item.name}
                className={`relative flex items-center justify-center h-10 w-10 mx-auto rounded-xl transition-all duration-150 ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={18} className={active ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--text-muted)]'} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      );
    }

    return (
      <div>
        <p className="px-3 text-[10px] font-semibold tracking-[0.15em] uppercase mb-1.5 text-[var(--text-muted)]">
          {title}
        </p>
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={16} className={active ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--text-muted)]'} />
                <span className="flex-1 truncate">{item.name}</span>
                {item.badge > 0 && (
                  <span className="h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSidebarBody = ({ isCollapsed = false, onNavigate = () => {} }) => {
    return (
      <div className="flex flex-col h-full">
        {/* Logo / Header */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center mb-6 px-0' : 'gap-3 mb-6 px-2'}`}>
          <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800 flex items-center justify-center shrink-0 overflow-hidden">
            <img src={logo} alt="Vaultix Logo" className="h-7 w-7 object-contain" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-[var(--text-primary)] leading-tight">
                Vault<span className="text-blue-600 dark:text-blue-400">ix</span>
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {user?.role === 'ADMIN' ? 'Administrator' : 'User'}
              </p>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-0.5 min-h-0">
          {renderNavSection('Overview', overviewMenu, isCollapsed, onNavigate)}
          {renderNavSection('Vaults', vaultMenu, isCollapsed, onNavigate)}
          {renderNavSection('Departments', deptMenu, isCollapsed, onNavigate)}

          {/* Company Vault */}
          {isCollapsed ? (
            <div className="space-y-1">
              <div className="my-1.5 border-t border-[var(--border-secondary)] mx-1" />
              {!vaultsLoading && vaults.map((vault) => {
                const vaultActive = location.pathname === `/vaults/${vault.slug}`;
                return (
                  <Link
                    key={vault.id}
                    to={`/vaults/${vault.slug}`}
                    onClick={() => {
                      dispatch(clearSelectedFolder());
                      onNavigate();
                    }}
                    title={vault.name}
                    className={`flex items-center justify-center h-10 w-10 mx-auto rounded-xl transition-all duration-150 ${
                      vaultActive
                        ? 'bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <FolderOpen size={18} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div>
              <p className="px-3 text-[10px] font-semibold tracking-[0.15em] uppercase mb-1.5 text-[var(--text-muted)]">
                Company Vault
              </p>

              {vaultsLoading && (
                <p className="text-xs text-[var(--text-muted)] px-3 py-2">Loading vaults...</p>
              )}

              {!vaultsLoading && vaults.map((vault) => {
                const vaultActive = location.pathname === `/vaults/${vault.slug}`;
                return (
                  <div key={vault.id} className="mb-1">
                    <div className={`flex items-center justify-between px-2 py-2 rounded-xl transition-all duration-150 ${
                      vaultActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800'
                        : 'border border-transparent hover:bg-[var(--bg-hover)]'
                    }`}>
                      <Link
                        to={`/vaults/${vault.slug}`}
                        onClick={() => {
                          dispatch(clearSelectedFolder());
                          onNavigate();
                        }}
                        className="flex items-center gap-2.5 flex-1 min-w-0"
                        title={vault.name}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          vaultActive ? 'bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                        }`}>
                          <FolderOpen size={16} />
                        </div>
                        <span className={`text-sm truncate ${
                          vaultActive ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-[var(--text-secondary)] font-medium'
                        }`}>
                          {vault.name}
                        </span>
                      </Link>

                      <div className="flex items-center gap-1 ml-1 shrink-0">
                        {vaultActive && user?.role === 'ADMIN' && (
                          <button
                            onClick={() => dispatch(openAddFolderModal())}
                            className="w-7 h-7 rounded-lg bg-[var(--bg-card)] border border-blue-200 dark:border-blue-700 flex items-center justify-center text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            title="Add folder"
                          >
                            <Plus size={13} />
                          </button>
                        )}
                        {vaultActive && <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                      </div>
                    </div>

                    {/* Folders */}
                    {vaultActive && (
                      <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-blue-100 dark:border-blue-800 pl-3">
                        {foldersLoading && (
                          <p className="text-xs text-[var(--text-muted)] py-1">Loading folders...</p>
                        )}
                        {!foldersLoading && folders.map((folder) => {
                          const selected = selectedFolderId === folder.id;
                          const folderPermission = folder?.permissions?.find(
                            (item) => item.userId === user?.id || item.user?.id === user?.id
                          );
                          const deptMember = folder?.departmentMembers?.find(
                            (dm) => dm.user?.id === user?.id
                          );
                          const getRank = (lvl) => ({ READ_ONLY: 0, READ_WRITE: 1, FULL_ACCESS: 2, ADMINISTRATOR: 3 }[lvl] ?? -1);
                          const deptAccess = deptMember?.accessLevel || null;
                          const directAccess = folderPermission?.accessLevel || null;
                          const bestAccess = (() => {
                            if (!directAccess && !deptAccess) return null;
                            if (!directAccess) return deptAccess;
                            if (!deptAccess) return directAccess;
                            return getRank(directAccess) >= getRank(deptAccess) ? directAccess : deptAccess;
                          })();
                          const folderAccess = user?.role === 'ADMIN'
                            ? 'ADMINISTRATOR'
                            : bestAccess;
                          const canManageFolder = user?.role === 'ADMIN' || folderAccess === 'ADMINISTRATOR';

                          return (
                            <div
                              key={folder.id}
                              className={`group w-full flex items-center justify-between pr-1 rounded-xl transition-all duration-150 ${
                                selected
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  dispatch(selectFolder(folder.id));
                                  onNavigate();
                                }}
                                className="flex items-center gap-2.5 pl-2.5 pr-1.5 py-2 text-left text-sm flex-1 min-w-0 focus:outline-none"
                                title={folder.name}
                              >
                                <Folder
                                  size={16}
                                  className={`shrink-0 ${
                                    selected ? 'text-blue-500 dark:text-blue-400' : 'text-[var(--text-muted)]'
                                  }`}
                                />
                                <span className="truncate flex-1 min-w-0 text-sm">
                                  {folder.name}
                                </span>
                              </button>
                              <FolderActionsMenu
                                folder={folder}
                                canManage={canManageFolder}
                                isSelected={selected}
                                onRename={openRename}
                                onShare={openShare}
                                onDelete={handleDeleteFolder}
                              />
                            </div>
                          );
                        })}
                        {!foldersLoading && !folders.length && (
                          <p className="text-xs text-[var(--text-muted)] py-2 px-2">No folders</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {renderNavSection('Security & Monitoring', securityMenu, isCollapsed, onNavigate)}
          {renderNavSection('Settings', settingsMenu, isCollapsed, onNavigate)}

          {/* Tools */}
          {isCollapsed ? (
            <div className="space-y-1">
              <div className="my-1.5 border-t border-[var(--border-secondary)] mx-1" />
              {toolsMenu.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => { setToolsOpen(true); onNavigate(); }}
                    title={item.name}
                    className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150"
                  >
                    <Icon size={18} className="text-[var(--text-muted)]" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <p className="px-3 text-[10px] font-semibold tracking-[0.15em] uppercase mb-1.5 text-[var(--text-muted)]">
                Tools
              </p>
              <div className="space-y-0.5">
                {toolsMenu.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => { setToolsOpen(true); onNavigate(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    >
                      <Icon size={16} className="text-[var(--text-muted)]" />
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {renderNavSection('Administration', adminMenu, isCollapsed, onNavigate)}
          {renderNavSection('Account', accountMenu, isCollapsed, onNavigate)}

          {error && !isCollapsed && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-3 py-2">
              <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Divider & Actions */}
        <div className="border-t border-[var(--border-secondary)] mt-3 pt-3 space-y-1 shrink-0">
          {isCollapsed ? (
            <>
              {isMasterVerified && (
                <button
                  onClick={() => { lockVault(); onNavigate(); }}
                  title="Lock Vault"
                  className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl text-[var(--text-muted)] hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-400 transition-all duration-150"
                >
                  <LockKeyhole size={18} />
                </button>
              )}
              <button
                onClick={() => { handleLogout(); onNavigate(); }}
                title="Logout"
                className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl text-[var(--text-muted)] hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150"
              >
                <LogOut size={18} />
              </button>
              <button
                onClick={toggleSidebarCollapse}
                title="Expand sidebar"
                className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150"
              >
                <PanelLeftOpen size={18} />
              </button>
            </>
          ) : (
            <>
              {isMasterVerified && (
                <button
                  onClick={() => { lockVault(); onNavigate(); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-400 transition-all duration-150"
                >
                  <LockKeyhole size={16} />
                  <span>Lock Vault</span>
                </button>
              )}
              <button
                onClick={() => { handleLogout(); onNavigate(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
              {/* Collapse button for desktop view */}
              <button
                onClick={toggleSidebarCollapse}
                className="hidden lg:flex w-full items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150"
                title="Collapse sidebar to icon bar"
              >
                <PanelLeftClose size={16} />
                <span>Collapse sidebar</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-primary)] py-5 transition-all duration-200 shrink-0 ${
          sidebarCollapsed ? 'w-[72px] px-2' : 'w-[260px] px-3'
        }`}
      >
        {renderSidebarBody({ isCollapsed: sidebarCollapsed })}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[275px] max-w-[85vw] bg-[var(--bg-sidebar)] border-r border-[var(--border-primary)] px-3 py-5 flex flex-col shadow-2xl lg:hidden transform transition-transform duration-300 ease-in-out ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute right-3 top-4">
          <button
            onClick={closeMobileSidebar}
            className="p-1.5 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
        {renderSidebarBody({ isCollapsed: false, onNavigate: closeMobileSidebar })}
      </aside>

      <ShareFolderModal
        open={shareOpen}
        onClose={() => { setShareOpen(false); setActionFolder(null); }}
        folderId={actionFolder?.id || null}
        vaultId={currentVaultId}
      />
      <RenameFolderModal
        open={renameOpen}
        onClose={() => { setRenameOpen(false); setActionFolder(null); }}
        folder={actionFolder}
        vaultId={currentVaultId}
      />
      <ConfirmModal
        open={confirmDelete.open}
        title="Delete Folder"
        message={`Are you sure you want to delete "${confirmDelete.folder?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={executeDeleteFolder}
        onCancel={() => setConfirmDelete({ open: false, folder: null })}
      />

      <PasswordGeneratorModal
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
      />
    </>
  );
}

export default Sidebar;
