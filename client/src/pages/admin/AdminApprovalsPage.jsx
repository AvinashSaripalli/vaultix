import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Trash2,
  FolderX,
  FileSpreadsheet,
  Ban,
  ArrowRight,
  Filter,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import RoleBadge from '../../components/common/RoleBadge';
import ConfirmModal from '../../components/common/ConfirmModal';
import api from '../../services/api';
import { isAdmin, isSuperAdmin } from '../../utils/roles';
import { showToast } from '../../utils/toast';

const ACTION_LABELS = {
  DELETE_ADMIN: {
    label: 'Delete Administrator',
    icon: Trash2,
    color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
  },
  DELETE_FOLDER: {
    label: 'Delete Shared Folder',
    icon: FolderX,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
  },
  PURGE_TRASH: {
    label: 'Permanent Trash Purge',
    icon: Trash2,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
  },
  EXPORT_AUDIT: {
    label: 'Export Audit Data',
    icon: FileSpreadsheet,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800',
  },
};

function AdminApprovalsPage() {
  const { user, token } = useSelector((state) => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') || (!isSuperAdmin(user) ? 'my-requests' : 'actionable');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['actionable', 'my-requests', 'history'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Action dialogs
  const [actionModal, setActionModal] = useState({
    open: false,
    type: null, // 'approve' | 'reject' | 'cancel'
    request: null,
    note: '',
    loading: false,
  });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/admin-approvals?tab=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch approval requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchRequests();
  }, [user, token, activeTab]);

  const handleOpenAction = (type, request) => {
    setActionModal({
      open: true,
      type,
      request,
      note: '',
      loading: false,
    });
  };

  const handleExecuteAction = async () => {
    if (!actionModal.request) return;
    const { id } = actionModal.request;

    try {
      setActionModal((prev) => ({ ...prev, loading: true }));

      if (actionModal.type === 'approve') {
        const res = await api.post(
          `/admin-approvals/${id}/approve`,
          { note: actionModal.note },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showToast(res.data?.message || 'Request approved and executed successfully');
      } else if (actionModal.type === 'reject') {
        const res = await api.post(
          `/admin-approvals/${id}/reject`,
          { note: actionModal.note },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showToast(res.data?.message || 'Request rejected');
      } else if (actionModal.type === 'cancel') {
        const res = await api.post(
          `/admin-approvals/${id}/cancel`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showToast(res.data?.message || 'Request cancelled');
      }

      setActionModal({ open: false, type: null, request: null, note: '', loading: false });
      fetchRequests();
    } catch (err) {
      showToast(err.response?.data?.message || 'Action failed', 'error');
      setActionModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock size={12} /> Pending Review
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={12} /> Approved & Executed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle size={12} /> Rejected
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Ban size={12} /> Cancelled
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Clock size={12} /> Expired
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-6 pb-12">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <UserCheck size={26} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isSuperAdmin(user) ? 'Dual-Admin Approvals' : 'My Requests & Approvals'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {isSuperAdmin(user)
                    ? 'Enforcing the Four-Eyes Principle: high-stakes administrative operations require consensus from two administrators.'
                    : 'Track and manage authorization requests submitted for Super Admin review.'}
                </p>
              </div>
            </div>

            <button
              onClick={fetchRequests}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-semibold transition"
            >
              <RotateCcw size={15} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Navigation Filter Tabs */}
          <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 overflow-x-auto">
            {isSuperAdmin(user) && (
              <button
                onClick={() => setActiveTab('actionable')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  activeTab === 'actionable'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Awaiting My Review
              </button>
            )}
            <button
              onClick={() => setActiveTab('my-requests')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeTab === 'my-requests'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              My Initiated Requests
            </button>
            {isAdmin(user) && (
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                All Approval History
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Strict Super Admin Approval Notification for Administrators */}
        {!isSuperAdmin(user) && activeTab === 'actionable' && (
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 text-xs sm:text-sm text-indigo-800 dark:text-indigo-300 flex items-center gap-3">
            <ShieldAlert size={20} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>
              <strong>Strict Super Admin Approval Policy:</strong> Only Super Admins have the executive authority to approve or reject pending requests. You can monitor requests you initiated under <strong>"My Initiated Requests"</strong>.
            </span>
          </div>
        )}

        {/* Requests List */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-slate-500">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-sm font-medium">Loading approval requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
            <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto text-slate-400 mb-4">
              <ShieldAlert size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {activeTab === 'actionable'
                ? isSuperAdmin(user)
                  ? 'No Pending Actions Awaiting Your Review'
                  : 'Super Admin Authorization Required'
                : activeTab === 'my-requests'
                ? 'You have not submitted any approval requests'
                : 'No Approval History Recorded'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {activeTab === 'actionable'
                ? isSuperAdmin(user)
                  ? 'When an administrator requests a critical action (such as deleting an admin account), it will appear here for your approval.'
                  : 'Under the Strict Super Admin Policy, only Super Admins have the authority to authorize or reject pending requests.'
                : activeTab === 'my-requests'
                ? 'High-stakes actions you initiate (such as deleting an administrator) will appear here for tracking.'
                : 'A permanent audit log of all authorized, rejected, and expired requests is stored here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const meta = ACTION_LABELS[req.actionType] || {
                label: req.actionType,
                icon: AlertTriangle,
                color: 'text-slate-600 bg-slate-100 border-slate-200',
              };
              const ActionIcon = meta.icon;
              const isActionable = req.status === 'PENDING' && req.requesterId !== user?.id && isSuperAdmin(user);
              const isMyPending = req.status === 'PENDING' && req.requesterId === user?.id;

              return (
                <div
                  key={req.id}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0 ${meta.color}`}
                      >
                        <ActionIcon size={22} />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border uppercase tracking-wider ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                          {getStatusBadge(req.status)}
                          <span className="text-xs text-slate-400">
                            Requested {new Date(req.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                          {req.title}
                        </h2>

                        {req.description && (
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            {req.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pt-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Initiator:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {req.requester?.fullName || req.requester?.email}
                            </span>
                            <RoleBadge role={req.requester?.role} />
                          </div>

                          {req.approver && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">
                                {req.status === 'APPROVED' ? 'Approved by:' : 'Reviewed by:'}
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {req.approver?.fullName || req.approver?.email}
                              </span>
                              <RoleBadge role={req.approver?.role} />
                            </div>
                          )}

                          {req.responseNote && (
                            <div className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 italic">
                              "{req.responseNote}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2.5 lg:shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-700">
                      {isActionable && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenAction('reject', req)}
                            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs sm:text-sm font-semibold transition"
                          >
                            <XCircle size={16} />
                            <span>Reject</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenAction('approve', req)}
                            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition shadow-sm"
                          >
                            <CheckCircle2 size={16} />
                            <span>Authorize & Execute</span>
                          </button>
                        </>
                      )}

                      {isMyPending && (
                        <button
                          type="button"
                          onClick={() => handleOpenAction('cancel', req)}
                          className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold transition"
                        >
                          <Ban size={15} />
                          <span>Cancel My Request</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Confirmation Modal */}
        {actionModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    actionModal.type === 'approve'
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300'
                  }`}
                >
                  {actionModal.type === 'approve' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {actionModal.type === 'approve'
                      ? 'Confirm Dual-Admin Authorization'
                      : actionModal.type === 'reject'
                      ? 'Reject Approval Request'
                      : 'Cancel Approval Request'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {actionModal.request?.title}
                  </p>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                {actionModal.type === 'approve' ? (
                  <span>
                    By authorizing this request, you confirm that you have reviewed the proposed action.
                    <strong> The action will be executed immediately upon your approval.</strong>
                  </span>
                ) : actionModal.type === 'reject' ? (
                  <span>
                    Rejecting this request prevents the proposed high-stakes action from taking place.
                  </span>
                ) : (
                  <span>
                    Are you sure you want to cancel this pending approval request?
                  </span>
                )}
              </div>

              {actionModal.type !== 'cancel' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {actionModal.type === 'approve' ? 'Audit Note (Optional)' : 'Reason for Rejection (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={actionModal.note}
                    onChange={(e) => setActionModal((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder={
                      actionModal.type === 'approve'
                        ? 'e.g. Verified with team lead, authorized.'
                        : 'e.g. Account still needed for upcoming audit.'
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setActionModal({ open: false, type: null, request: null, note: '', loading: false })}
                  disabled={actionModal.loading}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExecuteAction}
                  disabled={actionModal.loading}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold transition shadow-sm ${
                    actionModal.type === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionModal.loading
                    ? 'Processing...'
                    : actionModal.type === 'approve'
                    ? 'Confirm & Authorize'
                    : actionModal.type === 'reject'
                    ? 'Reject Request'
                    : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default AdminApprovalsPage;
