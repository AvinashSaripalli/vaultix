import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import api from '../../services/api';
import ConfirmModal from '../../components/common/ConfirmModal';
import ModalPortal from '../../components/common/ModalPortal';
import { showToast } from '../../utils/toast';

function AddUserPage() {
  const { token, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'USER',
  });

  const [tableLoading, setTableLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    const loadUsers = async () => {
      try {
        setTableLoading(true);
        setError('');

        const res = await api.get('/users', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUsers(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch users');
      } finally {
        setTableLoading(false);
      }
    };

    loadUsers();
  }, [token, user?.role]);

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleDelete = (id, fullName) => {
    setDeleteUser({ id, fullName });
  };

  const confirmDeleteUser = async () => {
    if (!deleteUser) return;

    try {
      setDeleting(true);

      await api.delete(`/users/${deleteUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      showToast('User deleted');
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
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');

      await api.post('/users', form, {
        headers: { Authorization: `Bearer ${token}` },
      });

      navigate('/team-management');
    } catch (err) {
      setError(err.response?.data?.message || 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="relative">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 dark:bg-slate-800 dark:border-slate-700">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                Team Management
              </h1>
              <p className="text-slate-500 mt-2 dark:text-slate-400">
                Manage users, roles, and access
              </p>
            </div>

            <button
              onClick={() => navigate('/team-management/add')}
              className="h-11 px-5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700"
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
              <table className="w-full">
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
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            u.role === 'ADMIN'
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {u.role}
                        </span>
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
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Add User</h2>
                <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                  Create a new team member
                </p>
              </div>

              <button
                onClick={() => navigate('/team-management')}
                className="text-slate-400 hover:text-slate-600 text-xl dark:text-slate-500 dark:hover:text-slate-300"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  className="w-full h-12 border border-slate-300 rounded-xl px-4 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2 dark:text-slate-300">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter email"
                  className="w-full h-12 border border-slate-300 rounded-xl px-4 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2 dark:text-slate-300">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  className="w-full h-12 border border-slate-300 rounded-xl px-4 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  required
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
                  className="w-full h-12 border border-slate-300 rounded-xl px-4 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

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
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </ModalPortal>

        <ConfirmModal
          open={!!deleteUser}
          title="Delete User"
          message={`Delete user "${deleteUser?.fullName}"?`}
          confirmLabel="Delete"
          onConfirm={confirmDeleteUser}
          onCancel={() => setDeleteUser(null)}
          loading={deleting}
        />
      </div>
    </AppLayout>
  );
}

export default AddUserPage;