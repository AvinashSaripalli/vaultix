import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import {
  Building2, Users, KeyRound, Plus, Pencil, Trash2, X,
  ChevronDown, ChevronUp, Search,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/common/ConfirmModal';
import ModalPortal from '../../components/common/ModalPortal';
import api from '../../services/api';
import { showToast } from '../../utils/toast';

const VAULT_ACCESS_LEVELS = ['NOT_SET', 'FORBIDDEN', 'READ_ONLY', 'READ_WRITE', 'FULL_ACCESS', 'ADMINISTRATOR'];

const DEPT_ACCESS_LABELS = {
  NOT_SET: 'Not set',
  FORBIDDEN: 'Forbidden',
  READ_ONLY: 'Read only',
  READ_WRITE: 'Read and edit',
  FULL_ACCESS: 'Full access',
  ADMINISTRATOR: 'Administrator',
};
const MEMBER_ROLES = ['MEMBER'];

function buildTree(departments) {
  const byId = new Map(departments.map((d) => [d.id, { ...d, children: [] }]));
  const roots = [];

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function buildFolderOptions(folders) {
  const byId = new Map(folders.map((f) => [f.id, { ...f, depth: 0, kids: [] }]));
  const roots = [];

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      node.depth = byId.get(node.parentId).depth + 1;
      byId.get(node.parentId).kids.push(node);
    } else {
      roots.push(node);
    }
  }

  const ordered = [];
  const walk = (nodes) => {
    nodes.forEach((node) => {
      ordered.push(node);
      walk(node.kids);
    });
  };
  walk(roots);

  return ordered;
}

function OrgNode({ node, selectedId, collapsed, toggleCollapsed, onSelect }) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <li className={hasChildren && !isCollapsed ? 'org-has-children' : ''}>
      <div className="org-node">
        <button
          onClick={() => onSelect(node.id)}
          className={`relative w-52 rounded-2xl border px-4 py-3 text-left transition-all duration-150 ${
            isSelected
              ? 'border-indigo-500 ring-4 ring-indigo-500/15 bg-white dark:bg-slate-800 shadow-lg'
              : 'border-[var(--border-primary)] bg-[var(--bg-card)] hover:border-indigo-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                isSelected
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              }`}
            >
              <Building2 size={14} />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {node.name}
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Users size={11} />
              {node.members.length} member{node.members.length === 1 ? '' : 's'}
            </span>
            {hasChildren && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapsed(node.id);
                }}
                className="ml-auto flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer dark:bg-slate-700 dark:text-slate-300"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                {node.children.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <ul>
          {node.children.map((child) => (
            <OrgNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              collapsed={collapsed}
              toggleCollapsed={toggleCollapsed}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}

      {hasChildren && isCollapsed && <div className="h-0" />}
    </li>
  );
}

function AddMemberModal({ open, onClose, users, existingMemberIds, onAdd }) {
  const [search, setSearch] = useState('');
  const [roleByUser, setRoleByUser] = useState({});
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setRoleByUser({});
      setAddingId(null);
    }
  }, [open]);

  if (!open) return null;

  const memberSet = new Set(existingMemberIds);
  const q = search.trim().toLowerCase();

  const candidates = users.filter(
    (u) =>
      !memberSet.has(u.id) &&
      (!q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  );

  const handleAdd = async (user) => {
    try {
      setAddingId(user.id);
      await onAdd(user, roleByUser[user.id] || 'MEMBER');
      setRoleByUser((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <ModalPortal open={open} onClose={onClose}>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-800 max-h-[85vh] flex flex-col my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Members</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pick users to add to this department
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            autoFocus
          />
        </div>

        <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {candidates.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {u.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {u.fullName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
              </div>

              <span className="h-9 flex items-center rounded-lg border border-slate-300 bg-slate-100 px-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                MEMBER
              </span>

              <button
                onClick={() => handleAdd(u)}
                disabled={addingId === u.id}
                className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus size={12} />
                {addingId === u.id ? 'Adding...' : 'Add'}
              </button>
            </div>
          ))}

          {!candidates.length && (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {search ? 'No users match your search.' : 'All users are already members.'}
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Done
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}

function DepartmentsPage() {
  const { token, user } = useSelector((state) => state.auth);

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [vaults, setVaults] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);

  const [grantForm, setGrantForm] = useState({
    targetType: 'VAULT',
    vaultId: '',
    folderId: '',
  });
  const [foldersCache, setFoldersCache] = useState({});

  const [confirmState, setConfirmState] = useState({ open: false, type: null, data: null });

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await api.get('/departments', authHeaders);

      setDepartments(res.data);

      setSelectedDeptId((prev) =>
        prev && res.data.some((d) => d.id === prev) ? prev : null
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    fetchDepartments();

    const fetchSupportData = async () => {
      try {
        const [usersRes, vaultsRes] = await Promise.all([
          api.get('/users/shareable', authHeaders),
          api.get('/vaults', authHeaders),
        ]);

        setUsers(usersRes.data);
        setVaults(vaultsRes.data.filter((v) => v.type !== 'PERSONAL'));
      } catch {
        // support lists are optional for rendering the page
      }
    };

    fetchSupportData();
  }, [user, fetchDepartments, authHeaders]);

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const tree = useMemo(() => buildTree(departments), [departments]);
  const selectedDept = departments.find((d) => d.id === selectedDeptId) || null;

  const toggleCollapsed = (id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const pruneHidden = (nodes) =>
    nodes
      .filter((node) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          node.name.toLowerCase().includes(q) ||
          node.description?.toLowerCase().includes(q) ||
          node.members.some(
            (m) =>
              m.user.fullName.toLowerCase().includes(q) ||
              m.user.email.toLowerCase().includes(q)
          )
        );
      })
      .map((node) => ({ ...node, children: pruneHidden(node.children) }));

  const visibleTree = useMemo(() => pruneHidden(tree), [tree, search]);

  const openDepartment = (id) => {
    setSelectedDeptId(id);
    setGrantForm({
      targetType: 'VAULT',
      vaultId: '',
      folderId: '',
      accessLevel: 'READ_ONLY',
    });
  };

  const closeDrawer = () => setSelectedDeptId(null);

  const openCreateModal = (parent = null) => {
    setEditingDept(null);
    setName('');
    setDescription('');
    setParentId(parent?.id || '');
    setFormOpen(true);
  };

  const openEditModal = (dept) => {
    setEditingDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setParentId(dept.parentId || '');
    setFormOpen(true);
  };

  const handleSaveDepartment = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Department name is required', 'error');
      return;
    }

    try {
      setSavingDept(true);

      if (editingDept) {
        await api.put(
          `/departments/${editingDept.id}`,
          { name: name.trim(), description, parentId: parentId || null },
          authHeaders
        );
        showToast('Department updated');
      } else {
        await api.post(
          '/departments',
          { name: name.trim(), description, parentId: parentId || null },
          authHeaders
        );
        showToast('Department created');
      }

      setFormOpen(false);
      await fetchDepartments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSavingDept(false);
    }
  };

  const requestConfirm = (type, data) => {
    setConfirmState({ open: true, type, data });
  };

  const confirmAction = async () => {
    const { type, data } = confirmState;

    if (!type || !data) return;

    try {
      if (type === 'department') {
        await api.delete(`/departments/${data.id}`, authHeaders);
        showToast('Department deleted');

        if (selectedDeptId === data.id) {
          setSelectedDeptId(null);
        }

        await fetchDepartments();
      } else if (type === 'member') {
        await api.delete(`/departments/${data.departmentId}/members/${data.userId}`, authHeaders);
        showToast('Member removed');
        await fetchDepartments();
      } else if (type === 'grant') {
        await api.delete(`/departments/${data.departmentId}/grants/${data.grantId}`, authHeaders);
        showToast('Access revoked');
        await fetchDepartments();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Action failed', 'error');
    } finally {
      setConfirmState({ open: false, type: null, data: null });
    }
  };

  const handleAddMemberFromPicker = async (pickedUser, memberRole) => {
    try {
      await api.post(
        `/departments/${selectedDept.id}/members`,
        { userId: pickedUser.id, memberRole },
        authHeaders
      );
      showToast(`${pickedUser.fullName} added`);
      await fetchDepartments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add member', 'error');
    }
  };

  const getFoldersForVault = async (vaultId) => {
    if (!vaultId || foldersCache[vaultId]) return foldersCache[vaultId] || [];

    try {
      const res = await api.get(`/folders/vault/${vaultId}`, authHeaders);
      const folders = res.data || [];

      setFoldersCache((prev) => ({ ...prev, [vaultId]: folders }));

      return folders;
    } catch {
      return [];
    }
  };

  const handleAddGrant = async () => {
    if (!selectedDept) return;

    if (grantForm.targetType === 'VAULT' && !grantForm.vaultId) {
      showToast('Select a vault first', 'error');
      return;
    }

    if (grantForm.targetType === 'FOLDER' && (!grantForm.vaultId || !grantForm.folderId)) {
      showToast('Select a vault and folder first', 'error');
      return;
    }

    const payload =
      grantForm.targetType === 'FOLDER'
        ? { folderId: grantForm.folderId }
        : { vaultId: grantForm.vaultId };

    try {
      await api.post(`/departments/${selectedDept.id}/grants`, payload, authHeaders);
      showToast('Access granted');

      setGrantForm((prev) => ({ ...prev, folderId: '' }));

      await fetchDepartments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to grant access', 'error');
    }
  };

  const selectableParentOptions = editingDept
    ? departments.filter((d) => d.id !== editingDept.id)
    : departments;

  const memberCountWithSubDepts = (dept) => {
    let count = dept.members.length;
    const stack = departments.filter((d) => d.parentId === dept.id);

    while (stack.length) {
      const current = stack.pop();
      count += current.members.length;
      stack.push(...departments.filter((d) => d.parentId === current.id));
    }

    return count;
  };

  const confirmTitle = {
    department: 'Delete Department',
    member: 'Remove Member',
    grant: 'Revoke Access',
  }[confirmState.type];

  const confirmMessage = {
    department: `Delete department "${confirmState.data?.name}"? All memberships and access grants will be removed.`,
    member: `Remove "${confirmState.data?.userName}" from this department? They will immediately lose department-based access.`,
    grant: 'Revoke this department access? Members will lose this access immediately.',
  }[confirmState.type];

  return (
    <AppLayout>
      <div className="space-y-6 min-w-0">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Departments</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-slate-400">
                Your organization structure. Click a department to view its members. Access granted
                to a parent flows down to all sub-departments.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full sm:w-48 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <button
                onClick={() => openCreateModal()}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 w-full sm:w-auto shadow-sm"
              >
                <Plus size={15} />
                New Department
              </button>
            </div>
          </div>
        </div>

        {/* Org chart */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {loading && <p className="text-slate-500 dark:text-slate-400">Loading structure...</p>}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && !visibleTree.length && (
            <div className="py-16 text-center">
              <Building2 size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400">
                {search
                  ? 'No departments match your search.'
                  : 'No departments yet. Create your first one to start building your organization.'}
              </p>
            </div>
          )}

          {!loading && !error && visibleTree.length > 0 && (
            <div className="org-chart overflow-x-auto pb-2 pt-2">
              <ul className="min-w-max mx-auto">
                {visibleTree.map((root) => (
                  <OrgNode
                    key={root.id}
                    node={root}
                    selectedId={selectedDeptId}
                    collapsed={collapsed}
                    toggleCollapsed={toggleCollapsed}
                    onSelect={openDepartment}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Department drawer */}
      {selectedDept && (
        <ModalPortal open={!!selectedDept} onClose={closeDrawer}>
          <div
            className="fixed inset-0 z-[9998] bg-slate-900/60 backdrop-blur-sm"
            onClick={closeDrawer}
          />

          <aside className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-white shadow-2xl overflow-y-auto dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-5 py-4 z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-indigo-500 shrink-0" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      {selectedDept.name}
                    </h3>
                  </div>
                  {selectedDept.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {selectedDept.description}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {selectedDept.parent ? `Part of ${selectedDept.parent.name} · ` : ''}
                    {memberCountWithSubDepts(selectedDept)} total incl. sub-departments
                  </p>
                </div>

                <button
                  onClick={closeDrawer}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus size={13} />
                  Add Member
                </button>
                <button
                  onClick={() => openCreateModal(selectedDept)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Plus size={13} />
                  Sub-department
                </button>
                <button
                  onClick={() => openEditModal(selectedDept)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Pencil size={13} />
                  Edit
                </button>
                <button
                  onClick={() =>
                    requestConfirm('department', {
                      id: selectedDept.id,
                      name: selectedDept.name,
                    })
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-6">
              {/* Members */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-slate-400" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Members ({selectedDept.members.length})
                  </h4>
                </div>

                <div className="space-y-2">
                  {selectedDept.members.map((membership) => (
                    <div
                      key={membership.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {membership.user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {membership.user.fullName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {membership.user.email}
                        </p>
                      </div>

                      <span className="h-8 shrink-0 flex items-center rounded-lg border border-slate-300 bg-slate-100 px-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        MEMBER
                      </span>

                      <button
                        onClick={() =>
                          requestConfirm('member', {
                            departmentId: selectedDept.id,
                            userId: membership.userId,
                            userName: membership.user.fullName,
                          })
                        }
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                        title="Remove member"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  {!selectedDept.members.length && (
                    <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No members yet. Use "Add Member" above.
                    </p>
                  )}
                </div>
              </section>

              {/* Access grants */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound size={15} className="text-slate-400" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Access Grants ({selectedDept.permissions.length})
                  </h4>
                </div>

                <div className="space-y-2">
                  {selectedDept.permissions.map((grant) => (
                    <div
                      key={grant.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {grant.folder ? grant.folder.name : grant.vault?.name}
                          <span className="ml-1.5 text-xs text-slate-400">
                            ({grant.folder ? 'Folder' : 'Vault'})
                          </span>
                        </p>
                        {grant.folder?.vault?.name && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            in {grant.folder.vault.name}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {DEPT_ACCESS_LABELS[grant.accessLevel] || grant.accessLevel}
                        </span>

                        <button
                          onClick={() =>
                            requestConfirm('grant', {
                              departmentId: selectedDept.id,
                              grantId: grant.id,
                            })
                          }
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Revoke access"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {!selectedDept.permissions.length && (
                    <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No access granted yet.
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/40">
                  <div className="flex gap-2">
                    {['VAULT', 'FOLDER'].map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setGrantForm((prev) => ({ ...prev, targetType: type }))
                        }
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                          grantForm.targetType === type
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-300 text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {type.charAt(0) + type.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Company vault
                    </label>
                    <select
                      value={grantForm.vaultId}
                      onChange={async (e) => {
                        setGrantForm((prev) => ({
                          ...prev,
                          vaultId: e.target.value,
                          folderId: '',
                        }));
                        await getFoldersForVault(e.target.value);
                      }}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    >
                      <option value="">Select vault...</option>
                      {vaults.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.type === 'CLIENT' ? 'Client' : 'Company'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {grantForm.targetType === 'FOLDER' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Folder in this vault
                      </label>
                      {!grantForm.vaultId ? (
                        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400 dark:border-slate-600">
                          Select a vault above to see its folders
                        </p>
                      ) : !(foldersCache[grantForm.vaultId] || []).length ? (
                        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400 dark:border-slate-600">
                          This vault has no folders yet
                        </p>
                      ) : (
                        <select
                          value={grantForm.folderId}
                          onChange={(e) =>
                            setGrantForm((prev) => ({ ...prev, folderId: e.target.value }))
                          }
                          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        >
                          <option value="">Select folder...</option>
                          {buildFolderOptions(foldersCache[grantForm.vaultId] || []).map(
                            (f) => (
                              <option key={f.id} value={f.id}>
                                {'\u00A0\u00A0'.repeat(f.depth)}
                                {f.depth > 0 ? '↳ ' : ''}
                                {f.name}
                              </option>
                            )
                          )}
                        </select>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {grantForm.targetType === 'FOLDER'
                      ? 'All department members get access to this folder.'
                      : 'All department members get access across this vault.'}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddGrant}
                      disabled={!vaults.length}
                      className="h-10 flex-1 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Grant Access
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </ModalPortal>
      )}

      <AddMemberModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        users={users}
        existingMemberIds={selectedDept ? selectedDept.members.map((m) => m.userId) : []}
        onAdd={handleAddMemberFromPicker}
      />

      {formOpen && (
        <ModalPortal open={formOpen} onClose={() => setFormOpen(false)}>
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={() => setFormOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-800 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingDept
                  ? 'Edit Department'
                  : parentId
                    ? 'Create Sub-department'
                    : 'Create Department'}
              </h3>
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Human Resources"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Parent department
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="">None (top-level)</option>
                  {selectableParentOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.parent ? `${d.parent.name} / ${d.name}` : d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What does this department do?"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDept}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingDept ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </ModalPortal>
      )}

      <ConfirmModal
        open={confirmState.open}
        title={confirmTitle || 'Confirm'}
        message={confirmMessage || ''}
        confirmLabel={
          confirmState.type === 'department'
            ? 'Delete'
            : confirmState.type === 'member'
              ? 'Remove'
              : 'Revoke'
        }
        onConfirm={confirmAction}
        onCancel={() => setConfirmState({ open: false, type: null, data: null })}
      />
    </AppLayout>
  );
}

export default DepartmentsPage;
