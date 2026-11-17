import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import {
  Building2, Users, Plus, Pencil, Trash2, X,
  ChevronDown, ChevronUp, Search, Network, List,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/common/ConfirmModal';
import ModalPortal, { ModalBackdrop } from '../../components/common/ModalPortal';
import api from '../../services/api';
import { showToast } from '../../utils/toast';

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

function DeptListItem({ node, selectedId, collapsed, toggleCollapsed, onSelect, depth = 0 }) {
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const isSelected = selectedId === node.id;
  const memberCount = node.members?.length || 0;

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all ${
          depth > 0 ? 'ml-3 sm:ml-6 border-l-4 border-l-indigo-400 dark:border-l-indigo-500' : ''
        } ${
          isSelected
            ? 'border-indigo-500 ring-2 ring-indigo-500/15 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-xs'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isSelected
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
            }`}
          >
            <Building2 size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                {node.name}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 text-[11px] font-medium">
                <Users size={11} />
                <span>{memberCount}</span>
              </span>
              {hasChildren && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-0.5 text-[11px] font-medium">
                  <span>{node.children.length} sub-depts</span>
                </span>
              )}
            </div>
            {node.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-md">
                {node.description}
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 transition"
          >
            View
          </button>

          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleCollapsed(node.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              title={isCollapsed ? 'Expand sub-departments' : 'Collapse sub-departments'}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="space-y-2 pt-1">
          {node.children.map((child) => (
            <DeptListItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              collapsed={collapsed}
              toggleCollapsed={toggleCollapsed}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
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
      <ModalBackdrop onClose={onClose}>
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
      </ModalBackdrop>
    </ModalPortal>
  );
}

function DepartmentsPage() {
  const { token, user } = useSelector((state) => state.auth);

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'tree'));

  const [formOpen, setFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);

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
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user?.role)) return;

    fetchDepartments();

    const fetchSupportData = async () => {
      try {
        const usersRes = await api.get('/users/shareable', authHeaders);
        setUsers(usersRes.data);
      } catch {
        // support lists are optional for rendering the page
      }
    };

    fetchSupportData();
  }, [user, fetchDepartments, authHeaders]);

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

  if (!['SUPER_ADMIN', 'ADMIN'].includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const openDepartment = (id) => {
    setSelectedDeptId(id);
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
  }[confirmState.type];

  const confirmMessage = {
    department: `Delete department "${confirmState.data?.name}"? All memberships will be removed.`,
    member: `Remove "${confirmState.data?.userName}" from this department?`,
  }[confirmState.type];

  return (
    <AppLayout>
      <div className="space-y-6 min-w-0">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Departments</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-slate-400">
                Your organization structure. Click a department to view its members.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0 flex-wrap">
              {/* View Toggle */}
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100/80 dark:bg-slate-750 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('tree')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    viewMode === 'tree'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title="Diagram tree view"
                >
                  <Network size={14} />
                  <span>Tree</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title="Collapsible list view (optimized for mobile)"
                >
                  <List size={14} />
                  <span>List</span>
                </button>
              </div>

              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full sm:w-44 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <button
                onClick={() => openCreateModal()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 w-full sm:w-auto shadow-sm"
              >
                <Plus size={15} />
                <span>New Department</span>
              </button>
            </div>
          </div>
        </div>

        {/* Org chart or List View */}
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
            viewMode === 'list' ? (
              <div className="space-y-3">
                {visibleTree.map((root) => (
                  <DeptListItem
                    key={root.id}
                    node={root}
                    selectedId={selectedDeptId}
                    collapsed={collapsed}
                    toggleCollapsed={toggleCollapsed}
                    onSelect={openDepartment}
                    depth={0}
                  />
                ))}
              </div>
            ) : (
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
            )
          )}
        </div>
      </div>

      {/* Department drawer */}
      {selectedDept && (
        <ModalPortal open={!!selectedDept} onClose={closeDrawer}>
          <ModalBackdrop
            className="fixed inset-0 z-[9998] bg-slate-900/60 backdrop-blur-sm"
            onClose={closeDrawer}
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
          <ModalBackdrop onClose={() => setFormOpen(false)} disableBackdropClick={true}>
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
          </ModalBackdrop>
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
