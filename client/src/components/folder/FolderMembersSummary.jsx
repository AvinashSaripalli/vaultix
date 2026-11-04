import { UsersRound } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function FolderMembersSummary({ onClick }) {
  const { token } = useSelector((state) => state.auth);
  const { folders, selectedFolderId } = useSelector((state) => state.vault);
  const [extraAdmins, setExtraAdmins] = useState(null);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  // If workspaceAdmins are not yet present on selectedFolder, fetch folder details as a fallback
  useEffect(() => {
    if (!selectedFolderId || selectedFolder?.workspaceAdmins) return;
    let isMounted = true;
    api
      .get(`/folders/${selectedFolderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (isMounted && res.data?.workspaceAdmins) {
          setExtraAdmins(res.data.workspaceAdmins);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedFolderId, selectedFolder?.workspaceAdmins, token]);

  const allMembers = useMemo(() => {
    if (!selectedFolder) return [];

    const permissions = selectedFolder?.permissions || [];
    const departmentMembers = selectedFolder?.departmentMembers || [];
    const workspaceAdmins = selectedFolder?.workspaceAdmins || extraAdmins || [];
    const owner = selectedFolder?.vault?.owner || null;

    // Build list of workspace admins who are not the owner
    const adminMembers = workspaceAdmins
      .filter(
        (admin) =>
          admin.id !== owner?.id &&
          !permissions.some(
            (p) => p.userId === admin.id || p.user?.id === admin.id
          )
      )
      .map((admin) => ({
        id: `admin-${admin.id}`,
        userId: admin.id,
        user: admin,
        accessLevel: 'ADMINISTRATOR',
        isAdminRole: true,
        isOwner: false,
      }));

    const directAndDeptMembers = [
      ...permissions,
      ...departmentMembers
        .filter(
          (dm) =>
            !permissions.some(
              (p) => p.userId === dm.user?.id || p.user?.id === dm.user?.id
            ) &&
            !adminMembers.some((a) => a.userId === (dm.user?.id || dm.userId))
        )
        .map((dm) => ({
          ...dm,
          id: `dept-${dm.user?.id || dm.userId}`,
          userId: dm.user?.id || dm.userId,
        })),
    ];

    const finalMembers = [
      ...(owner
        ? [
            {
              id: `owner-${owner.id}`,
              userId: owner.id,
              user: owner,
              accessLevel: 'ADMINISTRATOR',
              isOwner: true,
            },
          ]
        : []),
      ...adminMembers,
      ...directAndDeptMembers.filter((item) => {
        const uid = item.user?.id || item.userId;
        return uid !== owner?.id && !adminMembers.some((a) => a.userId === uid);
      }),
    ];

    return finalMembers;
  }, [selectedFolder, extraAdmins]);

  if (!selectedFolderId || !allMembers.length) return null;

  // Show up to 5 member avatars before overflowing, ensuring all members in typical teams are displayed
  const visibleMembers = allMembers.slice(0, 5);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3 text-left flex-wrap min-w-0 ${
        !onClick ? 'cursor-default' : 'cursor-pointer hover:opacity-90'
      }`}
    >
      <div className="flex items-center">
        {visibleMembers.map((item, index) => (
          <div
            key={item.id}
            className={`w-9 h-9 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center ${
              index !== 0 ? '-ml-2' : ''
            }`}
            title={item.user?.fullName || item.user?.email || 'User'}
          >
            {getInitials(item.user?.fullName || item.user?.email || 'U')}
          </div>
        ))}

        <div
          className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-800 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 flex items-center justify-center -ml-2"
          title="View all folder members and permissions"
        >
          <UsersRound size={16} />
        </div>
      </div>

      <div className="text-sm leading-tight">
        <div className="text-indigo-600 dark:text-indigo-400 font-medium">
          Shared with {allMembers.length} user
          {allMembers.length > 1 ? 's' : ''}
        </div>
        <div className="text-slate-400 dark:text-slate-500 text-xs">Folder members</div>
      </div>
    </button>
  );
}

export default FolderMembersSummary;
