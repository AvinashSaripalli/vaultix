import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Building2, Users, Plus, Pencil, Trash2, X, RefreshCw, AlertTriangle, Check, Search, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

export default function MobileDepartmentsSheet({ isOpen, onClose }) {
  const { token, user: currentUser } = useSelector((state) => state.auth);

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDept, setSelectedDept] = useState(null);

  // New Department Form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Add Member
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [addingUserId, setAddingUserId] = useState(null);

  const authHeaders = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/departments', authHeaders);
      setDepartments(res.data || []);
      if (selectedDept) {
        const updated = (res.data || []).find((d) => d.id === selectedDept.id);
        setSelectedDept(updated || null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/shareable', authHeaders);
      setUsers(res.data || []);
    } catch {
      //
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
      fetchUsers();
      setShowCreate(false);
      setSelectedDept(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateDepartment = async (e) => {
    e?.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError('');
    hapticMedium();

    try {
      await api.post('/departments', { name: name.trim(), description: description.trim() }, authHeaders);
      hapticSuccess();
      setName('');
      setDescription('');
      setShowCreate(false);
      fetchDepartments();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create department');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDepartment = async (dept) => {
    const confirm = window.confirm(`Delete department "${dept.name}"?`);
    if (!confirm) return;

    hapticMedium();
    try {
      await api.delete(`/departments/${dept.id}`, authHeaders);
      hapticSuccess();
      if (selectedDept?.id === dept.id) setSelectedDept(null);
      fetchDepartments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete department');
    }
  };

  const handleAddMember = async (targetUser) => {
    if (!selectedDept?.id) return;
    setAddingUserId(targetUser.id);
    hapticLight();

    try {
      await api.post(`/departments/${selectedDept.id}/members`, {
        userId: targetUser.id,
        role: 'MEMBER',
      }, authHeaders);
      hapticSuccess();
      fetchDepartments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add member to department');
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!selectedDept?.id) return;
    const confirm = window.confirm('Remove this member from the department?');
    if (!confirm) return;

    hapticLight();
    try {
      await api.delete(`/departments/${selectedDept.id}/members/${memberUserId}`, authHeaders);
      hapticSuccess();
      fetchDepartments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const existingMemberIds = new Set((selectedDept?.members || []).map((m) => m.userId || m.user?.id));
  const candidateUsers = users.filter((u) => {
    if (existingMemberIds.has(u.id)) return false;
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet */}
      <div className="w-full max-h-[88%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Departments</h2>
              <p className="text-[10px] text-slate-400">Workspaces, groups &amp; member permissions</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!selectedDept && !showCreate && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setShowCreate(true);
                }}
                className="h-8 px-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1 active:scale-95 transition"
              >
                <Plus size={14} />
                <span>New</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {selectedDept ? (
            /* DEPARTMENT DETAILS & MEMBERS */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedDept(null)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1"
              >
                ← All Departments
              </button>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">{selectedDept.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteDepartment(selectedDept)}
                    className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {selectedDept.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedDept.description}</p>
                )}
              </div>

              {/* Members Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Department Members ({selectedDept.members?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddMember(!showAddMember)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>{showAddMember ? 'Close' : 'Add Member'}</span>
                  </button>
                </div>

                {/* Add Member Drawer */}
                {showAddMember && (
                  <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 space-y-2">
                    <input
                      type="text"
                      placeholder="Search users to add..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {candidateUsers.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2 text-center">No eligible users found.</p>
                      ) : (
                        candidateUsers.map((u) => (
                          <div
                            key={u.id}
                            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                          >
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[170px]">{u.fullName}</span>
                            <button
                              type="button"
                              onClick={() => handleAddMember(u)}
                              disabled={addingUserId === u.id}
                              className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                            >
                              {addingUserId === u.id ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Existing Members List */}
                <div className="space-y-1.5">
                  {(selectedDept.members || []).map((m) => {
                    const memberUser = m.user || m;
                    return (
                      <div
                        key={memberUser.id || m.userId}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{memberUser.fullName || 'Member'}</p>
                          <p className="text-[10px] text-slate-400 truncate">{memberUser.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(memberUser.id || m.userId)}
                          className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : showCreate ? (
            /* CREATE FORM */
            <form onSubmit={handleCreateDepartment} className="space-y-3.5">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1"
              >
                ← Cancel
              </button>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering, Finance, Operations"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Brief description of this department"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={!name.trim() || creating}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-98 transition shadow-md shadow-indigo-600/20"
              >
                {creating ? 'Creating...' : 'Create Department'}
              </button>
            </form>
          ) : (
            /* DEPARTMENTS LIST */
            <>
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-indigo-500" />
                  <span>Loading departments...</span>
                </div>
              ) : departments.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-slate-400">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                    <Building2 size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Departments</p>
                  <p className="text-[11px] text-slate-400">Create departments to group users and manage folder access.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {departments.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => {
                        hapticLight();
                        setSelectedDept(d);
                      }}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer active:scale-98 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Building2 size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{d.name}</h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {d.members?.length || 0} members &middot; {d.description || 'No description'}
                          </p>
                        </div>
                      </div>

                      <ChevronRight size={16} className="text-slate-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
