import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { showToast } from '../../utils/toast';
import { ITEM_TYPES } from '../../utils/itemTypes';

const ALLOWED_TYPES_OPTIONS = ITEM_TYPES.map((item) => item.value);

function VaultPolicyModal({ open, onClose, vaultId }) {
  const [minStrengthScore, setMinStrengthScore] = useState('');
  const [maxAgeDays, setMaxAgeDays] = useState('');
  const [blockCommon, setBlockCommon] = useState(false);
  const [allowedTypes, setAllowedTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !vaultId) return;

    const fetchPolicy = async () => {
      try {
        setFetching(true);
        setError('');
        const res = await api.get(`/vaults/${vaultId}/policy`);
        const p = res.data || {};
        setMinStrengthScore(p.minStrengthScore != null ? String(p.minStrengthScore) : '');
        setMaxAgeDays(p.maxAgeDays != null ? String(p.maxAgeDays) : '');
        setBlockCommon(!!p.blockCommon);
        setAllowedTypes(Array.isArray(p.allowedTypes) ? p.allowedTypes : []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load policy');
      } finally {
        setFetching(false);
      }
    };

    fetchPolicy();
  }, [open, vaultId]);

  const toggleType = (type) => {
    setAllowedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      const body = {};

      if (minStrengthScore !== '') {
        const val = parseInt(minStrengthScore, 10);
        if (isNaN(val) || val < 1 || val > 5) {
          setError('Min strength score must be 1-5');
          setLoading(false);
          return;
        }
        body.minStrengthScore = val;
      }

      if (maxAgeDays !== '') {
        const val = parseInt(maxAgeDays, 10);
        if (isNaN(val) || val < 1) {
          setError('Max age must be a positive integer');
          setLoading(false);
          return;
        }
        body.maxAgeDays = val;
      }

      body.blockCommon = blockCommon;

      if (allowedTypes.length > 0) {
        body.allowedTypes = allowedTypes;
      }

      await api.put(`/vaults/${vaultId}/policy`, body);
      showToast('Policy updated successfully');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update policy');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Vault Policy</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500">
            <X size={20} />
          </button>
        </div>

        {fetching && (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading policy...</p>
        )}

        {!fetching && error && (
          <div className="mb-4 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-sm px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {!fetching && (
          <div className="space-y-5">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300 mb-1 block">
                Min Strength Score (1-5, leave empty for no limit)
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={minStrengthScore}
                onChange={(e) => setMinStrengthScore(e.target.value)}
                placeholder="e.g. 3"
                className="w-full border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300 mb-1 block">
                Max Age (days, leave empty for no limit)
              </label>
              <input
                type="number"
                min={1}
                value={maxAgeDays}
                onChange={(e) => setMaxAgeDays(e.target.value)}
                placeholder="e.g. 90"
                className="w-full border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="blockCommon"
                checked={blockCommon}
                onChange={(e) => setBlockCommon(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              <label htmlFor="blockCommon" className="text-sm text-slate-600 dark:text-slate-300">
                Block common passwords
              </label>
            </div>

            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300 mb-2 block">
                Allowed Types (leave all unchecked to allow all)
              </label>
              <div className="space-y-2">
                {ITEM_TYPES.map((item) => (
                  <label key={item.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowedTypes.includes(item.value)}
                      onChange={() => toggleType(item.value)}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Policy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VaultPolicyModal;
