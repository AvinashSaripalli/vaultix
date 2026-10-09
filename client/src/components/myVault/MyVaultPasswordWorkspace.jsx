import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Lock, LockKeyhole, Search, SearchX } from 'lucide-react';
import ItemTypeBadge from './ItemTypeBadge';
import ItemDetailsPanel from './ItemDetailsPanel';
import { getItemTypeMeta } from '../../utils/itemTypes';

function MyVaultPasswordWorkspace({
  loading,
  passwords,
  selectedPasswordId,
  onSelectPassword,
  onSharePassword,
  onEditPassword,
  onDeletePassword,
  onManageShares,
  onAddChild,
}) {
  const { user, sessionMasterPassword } = useSelector((state) => state.auth);
  const [search, setSearch] = useState('');

  const filteredPasswords = passwords.filter((item) => {
    const value = search.toLowerCase();
    return (
      item.name?.toLowerCase().includes(value) ||
      item.login?.toLowerCase().includes(value)
    );
  });

  const selectedPassword =
    filteredPasswords.find((item) => item.id === selectedPasswordId) ||
    filteredPasswords[0];

  const selectedPasswordChildren = selectedPassword
    ? passwords.filter((item) => item.parentId === selectedPassword.id)
    : [];

  const selectedPasswordParent = selectedPassword
    ? passwords.find((item) => item.id === selectedPassword.parentId)
    : null;

  const handleSelect = (id) => {
    onSelectPassword(id);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 min-h-[600px] overflow-hidden dark:bg-slate-800 dark:border-slate-700">
      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse dark:bg-slate-700" />
          ))}
        </div>
      ) : passwords.length === 0 ? (
        <div className="h-full min-h-[600px] flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
          <div className="h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
            <LockKeyhole size={28} className="text-indigo-400 dark:text-indigo-400" />
          </div>
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No items yet</p>
          <p className="text-sm">Add your first password, card or note to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr] min-h-[600px] divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700 min-w-0">
          {/* Left Side */}
          <div className="p-3.5 sm:p-5 bg-slate-50/50 dark:bg-slate-800/50 min-w-0">
            <div className="relative mb-5">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full border border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
              />
            </div>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Items</h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-200/70 dark:bg-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full">
                {filteredPasswords.length}
              </span>
            </div>

            {filteredPasswords.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-400 dark:text-slate-500">
                <SearchX size={22} />
                <p className="text-sm">No matching items</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPasswords.map((item) => {
                  const meta = getItemTypeMeta(item.type);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className={`w-full text-left rounded-xl border p-4 transition min-w-0 ${
                        selectedPassword?.id === item.id
                          ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
                          : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {item.parentId && (
                          <span className="text-slate-400 dark:text-slate-500 text-xs">↳</span>
                        )}
                        <h3 className="font-semibold text-slate-900 truncate flex items-center gap-1.5 flex-1 dark:text-slate-100 min-w-0">
                          {item.name}
                        </h3>
                        {item.isSensitive && (
                          <Lock size={12} className="text-emerald-600 shrink-0 dark:text-emerald-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 min-w-0">
                        <p className="text-sm text-slate-500 truncate dark:text-slate-400 min-w-0 flex-1">
                          {item.login || meta.label}
                        </p>
                        <ItemTypeBadge type={item.type} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Side */}
          <div className="p-4 sm:p-6 lg:p-8 min-w-0">
            {!selectedPassword ? (
              <div className="h-full min-h-[460px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 shadow-sm">
                  <Lock size={26} />
                </div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  No item selected
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                  Select an item from the list to view its credentials, secrets, and details.
                </p>
              </div>
            ) : (
              <>
                <ItemDetailsPanel
                  item={selectedPassword}
                  parent={selectedPasswordParent}
                  children={selectedPasswordChildren}
                  onSelectChild={handleSelect}
                  onAddChild={() => onAddChild(selectedPassword)}
                  onShare={onSharePassword}
                  onEdit={onEditPassword}
                  onDelete={onDeletePassword}
                  onManageShares={onManageShares}
                  user={user}
                  sessionMasterPassword={sessionMasterPassword}
                  samples={passwords.map((item) => item.encryptedPassword)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MyVaultPasswordWorkspace;
