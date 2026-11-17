import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import {
  Building2, Users, ChevronDown, ChevronUp, Search, X, Network, List,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import api from '../../services/api';
import ModalPortal, { ModalBackdrop } from '../../components/common/ModalPortal';

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

function DeptNode({ node, selectedId, collapsed, toggleCollapsed, onSelect }) {
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
            {node.myRole && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {node.myRole}
              </span>
            )}
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
            <DeptNode
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

function MyDepartmentsPage() {
  const { token, user } = useSelector((state) => state.auth);

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'tree'));

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
    fetchDepartments();
  }, [fetchDepartments]);

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

  if (['SUPER_ADMIN', 'ADMIN'].includes(user?.role)) {
    return <Navigate to="/departments" replace />;
  }

  const openDepartment = (id) => setSelectedDeptId(id);
  const closeDrawer = () => setSelectedDeptId(null);

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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 md:p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Departments</h1>
              <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                All departments in your organization. Access granted to a parent flows down to all sub-departments.
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
                className="h-10 w-full sm:w-48 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {loading && <p className="text-slate-500 dark:text-slate-400">Loading departments...</p>}

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
                  : 'No departments yet.'}
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
                    <DeptNode
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

      {selectedDept && (
        <ModalPortal open={!!selectedDept} onClose={closeDrawer}>
          <ModalBackdrop
            className="fixed inset-0 z-[9998] bg-slate-900/50 backdrop-blur-xs"
            onClose={closeDrawer}
          />

          <aside className="fixed inset-y-0 right-0 z-[9999] w-full max-w-md bg-white shadow-2xl overflow-y-auto dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 sm:px-5 py-4 z-10">
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

              <div className="mt-3">
                {selectedDept.myRole ? (
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    Your role: {selectedDept.myRole}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    Not a member
                  </span>
                )}
              </div>
            </div>

            <div className="px-4 sm:px-5 py-4 space-y-6">
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
                          {membership.userId === user?.id && (
                            <span className="ml-1 text-xs text-slate-400">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {membership.user.email}
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300 shrink-0">
                        {membership.memberRole}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </ModalPortal>
      )}
    </AppLayout>
  );
}

export default MyDepartmentsPage;
