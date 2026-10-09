import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import api from '../../services/api';
import PendingInvitationsModal from './PendingInvitationsModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import { showToast } from '../../utils/toast';

const USERS_PER_PAGE = 10;

function TeamManagementPage() {
  const { token, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await api.get('/users', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUsers(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [token, user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredUsers = users.filter((item) => {
    const q = search.toLowerCase();

    return (
      item.fullName?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.role?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE) || 1;

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE
  );

  const startItem =
    filteredUsers.length === 0 ? 0 : (currentPage - 1) * USERS_PER_PAGE + 1;

  const endItem = Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length);

  const handleDelete = (id, name) => {
    setDeleteUser({ id, name });
  };

  const confirmDeleteUser = async () => {
    if (!deleteUser) return;

    try {
      setDeleting(true);

      await api.delete(`/users/${deleteUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers((prev) => prev.filter((item) => item.id !== deleteUser.id));
      showToast('User deleted');
      setDeleteUser(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
      setDeleteUser(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 min-w-0">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                Team Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-slate-400">
                Manage users and send invitations
              </p>
            </div>

            <button
              onClick={() => setInviteModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 w-full sm:w-auto shadow-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M22 2L11 13"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M22 2L15 22L11 13L2 9L22 2Z"
                />
              </svg>

              Send Invitation
            </button>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-slate-100">Users</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Registered users in your workspace
              </p>
            </div>

            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 sm:h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm outline-none focus:border-indigo-500 sm:w-72 md:w-80 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>

          {loading && <p className="text-slate-500 dark:text-slate-400">Loading users...</p>}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[620px]">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr className="text-left text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      <th className="px-4 sm:px-5 py-3.5 sm:py-4">User</th>
                      <th className="px-4 sm:px-5 py-3.5 sm:py-4">Email</th>
                      <th className="px-4 sm:px-5 py-3.5 sm:py-4">Role</th>
                      <th className="px-4 sm:px-5 py-3.5 sm:py-4">Status</th>
                      <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedUsers.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
                      >
                        <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-full bg-indigo-100 text-xs sm:text-sm font-bold text-indigo-700 shrink-0 dark:bg-indigo-900/40 dark:text-indigo-300">
                              {item.fullName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>

                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate dark:text-slate-100 text-sm">
                                {item.fullName}
                              </p>
                              <p className="text-xs text-slate-400 truncate dark:text-slate-500">
                                ID: {item.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-sm text-slate-600 dark:text-slate-300">
                          {item.email}
                        </td>

                        <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                          <span
                            className={`rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold ${
                              item.role === 'ADMIN'
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {item.role}
                          </span>
                        </td>

                        <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                          <span
                            className={`rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold ${
                              item.isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {item.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/team-management/edit/${item.id}`)
                              }
                              className="rounded-xl border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() =>
                                handleDelete(item.id, item.fullName)
                              }
                              className="rounded-xl border border-red-200 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!paginatedUsers.length && (
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

              {filteredUsers.length > 0 && (
                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Showing {startItem} - {endItem} of {filteredUsers.length}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="rounded-xl border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalPages }, (_, index) => {
                      const page = index + 1;

                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl text-xs sm:text-sm font-semibold ${
                            currentPage === page
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(prev + 1, totalPages)
                        )
                      }
                      disabled={currentPage === totalPages}
                      className="rounded-xl border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <PendingInvitationsModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      <ConfirmModal
        open={!!deleteUser}
        title="Delete User"
        message={`Delete user "${deleteUser?.name}"?`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeleteUser(null)}
        loading={deleting}
      />
    </AppLayout>
  );
}

export default TeamManagementPage;