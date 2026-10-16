import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import api from '../../services/api';
import ConfirmModal from '../../components/common/ConfirmModal';
import ModalPortal from '../../components/common/ModalPortal';
import RoleBadge from '../../components/common/RoleBadge';
import { isAdmin, isOwner, ROLES, ROLE_DEFINITIONS } from '../../utils/roles';
import { showToast } from '../../utils/toast';

function EditUserPage() {
  const { token, user } = useSelector((state) => state.auth);
  const { id } = useParams();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [targetUser, setTargetUser] = useState(null);

  const [form, setForm] = useState({
    fullName: '',
    role: 'USER',
    isActive: true,
  });

  const [tableLoading, setTableLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAdmin(user)) return;

    const loadData = async () => {
      try {
        setTableLoading(true);
        setPageLoading(true);
        setError('');

        const res = await api.get('/users', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUsers(res.data);

        const foundUser = res.data.find((item) => item.id === id);

        if (!foundUser) {
          setError('User not found');
          return;
        }

        setTargetUser(foundUser);
        setForm({
          fullName: foundUser.fullName || '',
          role: foundUser.role || 'USER',
          isActive: foundUser.isActive ?? true,
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load user');
      } finally {
        setTableLoading(false);
        setPageLoading(false);
      }
    };

    loadData();
  }, [id, token, user]);

  if (!isAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleDelete = (userId, fullName) => {
    setDeleteUser({ id: userId, fullName });
  };

  const confirmDeleteUser = async () => {
    if (!deleteUser) return;

    try {
      setDeleting(true);

      const res = await api.delete(`/users/${deleteUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.approvalRequired) {
        showToast(res.data.message || 'Dual-Admin approval request created', 'info');
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
        showToast('User deleted');
        if (deleteUser.id === id) {
          navigate('/team-management');
        }
      }
      setDeleteUser(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
      setDeleteUser(null);
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    `${u.fullName} ${u.email} ${u.role}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');

      await api.put(
        `/users/${id}`,
        {
          fullName: form.fullName,
          role: form.role,
          isActive: form.isActive,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      navigate('/team-management');
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="relative">
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 dark:bg-slate-800 dark:border-slate-700 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
                Team Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-slate-400">
                Manage users, roles, and access
              </p>
            </div>

            <button
              onClick={() => navigate('/team-management/invite')}
              className="h-10 px-4 sm:px-5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 inline-flex items-center justify-center self-start sm:self-auto shrink-0 shadow-sm transition"
            >
              Add User
            </button>
          </div>

          <div className="mb-6">
            <input
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 border border-slate-300 rounded-xl px-4 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>

          {tableLoading && (
            <p className="text-slate-500 text-sm dark:text-slate-400">Loading users...</p>
          )}

          {!tableLoading && (
            <div className="overflow-x-auto border border-slate-200 rounded-xl dark:border-slate-700">
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr className="text-left text-slate-600 dark:text-slate-400">
                    <th className="px-5 py-4 font-semibold">Name</th>
                    <th className="px-5 py-4 font-semibold">Email</th>
                    <th className="px-5 py-4 font-semibold">Role</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {u.fullName}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {u.email}
                      </td>

                      <td className="px-5 py-4">
                        <RoleBadge role={u.role} />
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            u.isActive
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/team-management/edit/${u.id}`)}
                            className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(u.id, u.fullName)}
                            className="px-4 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!filteredUsers.length && (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-5 py-10 text-center text-slate-500 dark:text-slate-400"
                      >
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ModalPortal open onClose={() => navigate('/team-management')}>
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto"
            onClick={() => navigate('/team-management')}
          >
            <div
              className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl dark:bg-slate-800 dark:border-slate-700 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Edit User</h2>
                <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                  Update user role and status
                </p>
              </div>

              <button
                onClick={() => navigate('/team-management')}
                className="text-slate-400 hover:text-slate-600 text-xl dark:text-slate-500 dark:hover:text-slate-300"
              >
                ×
              </button>
            </div>

            {pageLoading && (
              <p className="text-slate-500 text-sm dark:text-slate-400">Loading user...</p>
            )}

            {error && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}

            {!pageLoading && !error && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {targetUser?.role === ROLES.OWNER && !isOwner(user) && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-300">
                    <p className="font-semibold">Protected Super Admin Account</p>
                    <p className="mt-0.5">
                      This user is a Super Admin. Only a Super Admin can modify this account's role, name, or active status.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-slate-600 mb-2 dark:text-slate-300">
                    Full Name
                  </label>
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    disabled={targetUser?.role === ROLES.OWNER && !isOwner(user)}
                    className="w-full h-12 border border-slate-300 rounded-xl px-4 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-2 dark:text-slate-300">
                    Role
                  </label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    disabled={targetUser?.role === ROLES.OWNER && !isOwner(user)}
                    className="w-full h-12 border border-slate-300 rounded-xl px-4 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="USER">Member</option>
                    <option value="ADMIN">Administrator</option>
                    {isOwner(user) && <option value="OWNER">Super Admin</option>}
                  </select>

                  <div className="mt-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700/80 dark:bg-slate-700/40 text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {ROLE_DEFINITIONS[form.role]?.tagline || form.role}
                    </p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400 leading-relaxed">
                      {ROLE_DEFINITIONS[form.role]?.description}
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleChange}
                    disabled={targetUser?.role === ROLES.OWNER && !isOwner(user)}
                    className="w-4 h-4 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  Active User
                </label>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/team-management')}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading || (targetUser?.role === ROLES.OWNER && !isOwner(user))}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
                  >
                    {loading ? 'Updating...' : 'Update User'}
                  </button>
                </div>
              </form>
            )}
          </div>
          </div>
        </ModalPortal>
      </div>

      <ConfirmModal
        open={!!deleteUser}
        title="Delete User"
        message={`Delete user "${deleteUser?.fullName}"?`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeleteUser(null)}
        loading={deleting}
      />
    </AppLayout>
  );
}

export default EditUserPage;