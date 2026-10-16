import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import api from '../../services/api';
import { isAdmin, isSuperAdmin, ROLES, ROLE_DEFINITIONS } from '../../utils/roles';

function InviteUserPage() {
  const { token, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('USER');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!isAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      setMessage('');

      const res = await api.post(
        '/invitations',
        { email, role },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage(res.data.message || 'Invitation sent successfully');
      setEmail('');
      setRole('USER');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-5 sm:space-y-6">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 lg:p-8 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1.5 text-slate-900 dark:text-slate-100">
            Send Invitation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 dark:text-slate-400">
            Send registration link to user email.
          </p>

          {message && (
            <div className="mb-4 bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm dark:bg-green-900/20 dark:text-green-300">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <input
              type="email"
              placeholder="Enter user email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 border border-slate-300 rounded-xl px-4 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              required
            />

            <div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-11 border border-slate-300 rounded-xl px-4 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                <option value="USER">Member</option>
                <option value="ADMIN">Administrator</option>
                {isSuperAdmin(user) && <option value="SUPER_ADMIN">Super Admin</option>}
              </select>

              <div className="mt-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700/80 dark:bg-slate-700/40 text-xs">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {ROLE_DEFINITIONS[role]?.tagline || role}
                </p>
                <p className="mt-1 text-slate-500 dark:text-slate-400 leading-relaxed">
                  {ROLE_DEFINITIONS[role]?.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/team-management')}
                className="h-10 sm:h-11 px-5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="h-10 sm:h-11 px-6 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

export default InviteUserPage;