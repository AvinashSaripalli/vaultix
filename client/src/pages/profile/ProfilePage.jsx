import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  LockKeyhole,
  LogIn,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  User,
  Eye,
  EyeOff,
  Smartphone,
  Clock,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import {
  updateProfile,
  changePassword,
  changeMasterPassword,
} from '../../features/auth/authSlice';
import { validateEmail, validateFullName } from '../../utils/validation';
import { encryptPrivateKey, generateRecoveryKey } from '../../utils/crypto';
import { setupRecoveryKey } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import { Link } from 'react-router-dom';

const TABS = [
  { key: 'info', label: 'Personal Info', icon: User },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'activity', label: 'Login Activity', icon: LogIn },
];

function ProfilePage() {
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('info');
  const [success, setSuccess] = useState('');
  const [serverError, setServerError] = useState('');

  const clearMessages = () => {
    setSuccess('');
    setServerError('');
  };

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-5 sm:space-y-6 pb-8">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-sm">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-lg sm:text-xl font-bold shrink-0">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
                Profile
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Manage your account and security settings
              </p>
            </div>
          </div>
        </div>

        {serverError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {serverError}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); clearMessages(); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'info' && (
          <InfoTab
            user={user}
            loading={loading}
            dispatch={dispatch}
            onSuccess={setSuccess}
            onError={setServerError}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTab
            user={user}
            loading={loading}
            dispatch={dispatch}
            onSuccess={setSuccess}
            onError={setServerError}
          />
        )}

        {activeTab === 'activity' && <ActivityTab />}
      </div>
    </AppLayout>
  );
}

function InfoTab({ user, loading, dispatch, onSuccess, onError }) {
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [myDepartments, setMyDepartments] = useState([]);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments/my');
        setMyDepartments(res.data || []);
      } catch {
        // departments are optional
      }
    };
    fetchDepts();
  }, []);

  const updateField = (field, value) => {
    setErrors((prev) => ({ ...prev, [field]: '' }));
    onSuccess('');
    onError('');
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const emailChanged = formData.email !== (user?.email || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    onSuccess('');
    onError('');

    const nameError = validateFullName(formData.fullName);
    const emailError = validateEmail(formData.email);

    if (nameError || emailError) {
      setErrors({ fullName: nameError, email: emailError });
      return;
    }

    if (emailChanged && !currentPassword) {
      setErrors({ currentPassword: 'Current password is required to change your email' });
      return;
    }

    const result = await dispatch(
      updateProfile({
        fullName: formData.fullName,
        email: formData.email,
        currentPassword: emailChanged ? currentPassword : undefined,
      })
    );
    if (updateProfile.fulfilled.match(result)) {
      onSuccess('Profile updated successfully');
      setCurrentPassword('');
    } else {
      onError(result.payload || 'Failed to update profile');
    }
  };

  const inputClass = (field) =>
    `w-full rounded-xl border bg-white dark:bg-slate-700 dark:text-slate-200 px-4 py-3 outline-none transition-all focus:ring-4 ${
      errors[field]
        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
        : 'border-slate-200 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-100'
    }`;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
          <User size={20} className="text-slate-400 dark:text-slate-500" />
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Personal Information</p>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              className={inputClass('fullName')}
              placeholder="Your full name"
            />
            {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              className={inputClass('email')}
              placeholder="Your email address"
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </div>

          {emailChanged && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setErrors((prev) => ({ ...prev, currentPassword: '' }));
                  setCurrentPassword(e.target.value);
                }}
                className={inputClass('currentPassword')}
                placeholder="Confirm your current password"
                autoComplete="current-password"
              />
              {errors.currentPassword && <p className="mt-1 text-sm text-red-500">{errors.currentPassword}</p>}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Role</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{user?.role || 'USER'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Account Created</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Master Password</span>
            <span className={`font-medium ${user?.hasMasterPassword ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {user?.hasMasterPassword ? 'Enabled' : 'Not Set'}
            </span>
          </div>
          {myDepartments.length > 0 && (
            <div className="flex justify-between items-start">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Departments</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {myDepartments.map((dept) => (
                  <span
                    key={dept.id}
                    className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  >
                    {dept.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition"
          >
            <Save size={16} />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SecurityTab({ user, loading, dispatch, onSuccess, onError }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwErrors, setPwErrors] = useState({});

  const [showMpCurrent, setShowMpCurrent] = useState(false);
  const [showMpNew, setShowMpNew] = useState(false);

  const [mpForm, setMpForm] = useState({
    currentMasterPassword: '',
    newMasterPassword: '',
    hint: '',
  });
  const [mpErrors, setMpErrors] = useState({});

  const privateKey = useSelector((state) => state.auth.sessionRsaPrivateKey);

  const inputClass = (field, errors) =>
    `w-full rounded-xl border bg-white dark:bg-slate-700 dark:text-slate-200 px-4 py-3 outline-none transition-all focus:ring-4 ${
      errors[field]
        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
        : 'border-slate-200 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-100'
    }`;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    onSuccess('');
    onError('');

    const errs = {};
    if (!pwForm.currentPassword) errs.currentPassword = 'Current password is required';
    if (!pwForm.newPassword) errs.newPassword = 'New password is required';
    else if (pwForm.newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=<>?/{}[\]|~`])/.test(pwForm.newPassword))
      errs.newPassword = 'Must include uppercase, lowercase, number, and special character';

    if (Object.keys(errs).length) {
      setPwErrors(errs);
      return;
    }

    setPwErrors({});
    const result = await dispatch(changePassword(pwForm));
    if (changePassword.fulfilled.match(result)) {
      onSuccess('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '' });
    } else {
      onError(result.payload || 'Failed to change password');
    }
  };

  const handleChangeMasterPassword = async (e) => {
    e.preventDefault();
    onSuccess('');
    onError('');

    const errs = {};
    if (!mpForm.currentMasterPassword) errs.currentMasterPassword = 'Current master password is required';
    if (!mpForm.newMasterPassword) errs.newMasterPassword = 'New master password is required';
    else if (mpForm.newMasterPassword.length < 8) errs.newMasterPassword = 'Must be at least 8 characters';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=<>?/{}[\]|~`])/.test(mpForm.newMasterPassword))
      errs.newMasterPassword = 'Must include uppercase, lowercase, number, and special character';

    if (Object.keys(errs).length) {
      setMpErrors(errs);
      return;
    }

    setMpErrors({});
    const result = await dispatch(changeMasterPassword(mpForm));
    if (changeMasterPassword.fulfilled.match(result)) {
      onSuccess('Master password changed successfully');
      setMpForm({ currentMasterPassword: '', newMasterPassword: '', hint: '' });
    } else {
      onError(result.payload || 'Failed to change master password');
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Login Password */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
        <form onSubmit={handleChangePassword} className="space-y-5">
          <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
            <Lock size={20} className="text-slate-400 dark:text-slate-500" />
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Change Password</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Update your account login password</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={pwForm.currentPassword}
                  onChange={(e) => { setPwErrors((p) => ({ ...p, currentPassword: '' })); setPwForm((p) => ({ ...p, currentPassword: e.target.value })); }}
                  className={inputClass('currentPassword', pwErrors)}
                  placeholder="Enter current password"
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                  {showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {pwErrors.currentPassword && <p className="mt-1 text-sm text-red-500">{pwErrors.currentPassword}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={pwForm.newPassword}
                  onChange={(e) => { setPwErrors((p) => ({ ...p, newPassword: '' })); setPwForm((p) => ({ ...p, newPassword: e.target.value })); }}
                  className={inputClass('newPassword', pwErrors)}
                  placeholder="Enter new password"
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                  {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {pwErrors.newPassword && <p className="mt-1 text-sm text-red-500">{pwErrors.newPassword}</p>}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              <Save size={16} />
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Master Password */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
        <form onSubmit={handleChangeMasterPassword} className="space-y-5">
          <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
            <KeyRound size={20} className="text-slate-400 dark:text-slate-500" />
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Change Master Password</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Update the key used to encrypt your vault data</p>
            </div>
          </div>

          {!user?.hasMasterPassword && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-400">
              You have not set a master password yet. Go to the first-time setup to create one.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Current Master Password</label>
              <div className="relative">
                <input
                  type={showMpCurrent ? 'text' : 'password'}
                  value={mpForm.currentMasterPassword}
                  onChange={(e) => { setMpErrors((p) => ({ ...p, currentMasterPassword: '' })); setMpForm((p) => ({ ...p, currentMasterPassword: e.target.value })); }}
                  className={inputClass('currentMasterPassword', mpErrors)}
                  placeholder="Enter current master password"
                />
                <button type="button" onClick={() => setShowMpCurrent(!showMpCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                  {showMpCurrent ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {mpErrors.currentMasterPassword && <p className="mt-1 text-sm text-red-500">{mpErrors.currentMasterPassword}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New Master Password</label>
              <div className="relative">
                <input
                  type={showMpNew ? 'text' : 'password'}
                  value={mpForm.newMasterPassword}
                  onChange={(e) => { setMpErrors((p) => ({ ...p, newMasterPassword: '' })); setMpForm((p) => ({ ...p, newMasterPassword: e.target.value })); }}
                  className={inputClass('newMasterPassword', mpErrors)}
                  placeholder="Enter new master password"
                />
                <button type="button" onClick={() => setShowMpNew(!showMpNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                  {showMpNew ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {mpErrors.newMasterPassword && <p className="mt-1 text-sm text-red-500">{mpErrors.newMasterPassword}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Hint (optional)</label>
              <input
                type="text"
                value={mpForm.hint}
                onChange={(e) => setMpForm((p) => ({ ...p, hint: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition"
                placeholder="A reminder for your master password"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || !user?.hasMasterPassword}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              <Save size={16} />
              {loading ? 'Changing...' : 'Change Master Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Master Password Recovery */}
      <RecoveryKeySetup
        user={user}
        privateKey={privateKey}
        onSuccess={onSuccess}
        onError={onError}
      />

      {/* Security Quick Links */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
          <Shield size={20} className="text-slate-400 dark:text-slate-500" />
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Account Security</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage additional security settings</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/security/2fa"
            className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Smartphone size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Two-Factor Authentication</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Add an extra layer of security</p>
            </div>
            <ChevronRightIcon />
          </Link>

          <Link
            to="/security/vault-timeout"
            className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Clock size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Vault Timeout</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Set auto-lock after inactivity</p>
            </div>
            <ChevronRightIcon />
          </Link>
        </div>
      </div>
    </div>
  );
}

function RecoveryKeySetup({ user, privateKey, onSuccess, onError }) {
  const [status, setStatus] = useState('loading');
  const [recoveryKey, setRecoveryKey] = useState(null);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get('/auth/me');
        setStatus(res.data?.hasRecoveryKey ? 'set' : 'not-set');
      } catch {
        setStatus('not-set');
      }
    };
    check();
  }, []);

  const handleGenerate = async () => {
    onSuccess('');
    onError('');
    setBusy(true);
    try {
      if (!privateKey) {
        onError('Could not load your encryption keys. Please unlock your vault first.');
        return;
      }
      const key = generateRecoveryKey();
      const escrow = await encryptPrivateKey(privateKey, key, user?.encryptionSalt);
      await setupRecoveryKey(key, escrow);
      setRecoveryKey(key);
      setStatus('set');
      onSuccess('Recovery key saved. Store it somewhere safe.');
    } catch (err) {
      onError(err.response?.data?.message || 'Failed to save recovery key. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
        Loading recovery key status...
      </div>
    );
  }

  const enabled = !!user?.hasMasterPassword;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
        <KeyRound size={20} className="text-slate-400 dark:text-slate-500" />
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Master Password Recovery Key</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create a recovery key so you can recover your vault if you forget your master password.
          </p>
        </div>
      </div>

      {!enabled ? (
        <div className="mt-5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-400">
          Set a master password first to enable recovery.
        </div>
      ) : recoveryKey ? (
        <div className="mt-5 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
            <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Save this recovery key in a safe place. It can also be emailed to you
              from the unlock screen if you forget your master password.
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/20 p-5 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Your recovery key</p>
            <p className="text-2xl font-black tracking-[2px] text-blue-700 dark:text-blue-300 font-mono">
              {showRecoveryKey ? recoveryKey : '••••-••••-••••'}
            </p>
            <button
              type="button"
              onClick={() => setShowRecoveryKey((prev) => !prev)}
              className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showRecoveryKey ? 'Hide recovery key' : 'Show recovery key'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setRecoveryKey(null); setShowRecoveryKey(false); }}
            className="w-full rounded-xl bg-slate-100 dark:bg-slate-700 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            Generate a new recovery key
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
            <Shield size={18} className={`shrink-0 ${status === 'set' ? 'text-emerald-500' : 'text-slate-400'}`} />
            {status === 'set'
              ? 'A recovery key is already set up for this account. You can generate a new one at any time.'
              : 'No recovery key is set up yet. Generate one to enable recovery of your vault.'}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleGenerate}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition"
          >
            <KeyRound size={16} />
            {busy ? 'Generating...' : 'Generate Recovery Key'}
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityTab() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/login-activity');
        setActivities(res.data.activities || []);
      } catch {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
        Loading...
      </div>
    );
  }

  if (!activities.length) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-slate-400 dark:text-slate-500">
        No login activity recorded
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
      <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
        <LogIn size={20} className="text-slate-400 dark:text-slate-500" />
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Login Activity</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Your last {activities.length} login attempts</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {activities.slice(0, 20).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                item.status === 'SUCCESS' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                item.status === 'FAILED' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
              }`}>
                <LogIn size={14} />
              </div>
              <div>
                <p className={`text-sm font-medium ${
                  item.status === 'SUCCESS' ? 'text-green-700 dark:text-green-400' :
                  item.status === 'FAILED' ? 'text-red-700 dark:text-red-400' :
                  'text-amber-700 dark:text-amber-400'
                }`}>
                  {item.status === 'SUCCESS' ? 'Successful Login' : item.status === 'FAILED' ? 'Failed Login' : 'Blocked'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 dark:text-slate-500">
              {item.ipAddress && <p>{item.ipAddress}</p>}
              {item.userAgent && (
                <p className="max-w-[200px] truncate" title={item.userAgent}>{item.userAgent}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProfilePage;

function ChevronRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
