import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  Sparkles,
  ShieldCheck,
  Settings,
  Plus,
} from 'lucide-react';
import { isMobileNative, getMobilePlatform } from '../../utils/mobileBiometrics';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import PasswordGeneratorModal from '../tools/PasswordGeneratorModal';

export default function MobileNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [generatorOpen, setGeneratorOpen] = useState(false);

  // Determine platform style: iOS vs Android
  const platform = getMobilePlatform(); // 'ios', 'android', or 'web'
  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';

  const pathname = location.pathname;

  const isVaultActive =
    pathname === '/my-vault' ||
    pathname === '/dashboard' ||
    pathname.startsWith('/vaults/');
  const isSharedActive = pathname === '/shared-with-me';
  const isHealthActive = pathname === '/security/password-health';
  const isSettingsActive =
    pathname === '/profile' ||
    pathname.startsWith('/security/') && pathname !== '/security/password-health';

  const handleTabClick = (path) => {
    hapticLight();
    navigate(path);
  };

  const handleOpenGenerator = () => {
    hapticLight();
    setGeneratorOpen(true);
  };

  const handleFabClick = () => {
    hapticSuccess();
    // Dispatch event that vault pages can listen to for opening Add Item modal
    window.dispatchEvent(new CustomEvent('vaultix:mobile-add-item'));
    // If not already in vaults, navigate to my-vault
    if (!pathname.startsWith('/vaults/') && pathname !== '/my-vault') {
      navigate('/my-vault');
    }
  };

  return (
    <>
      {/* Android Floating Action Button (FAB) */}
      {isAndroid && isVaultActive && (
        <button
          type="button"
          onClick={handleFabClick}
          aria-label="Add item"
          className="fixed right-5 bottom-24 z-40 w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/35 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-150"
        >
          <Plus size={26} strokeWidth={2.6} />
        </button>
      )}

      {/* Navigation Bar */}
      {isIOS ? (
        /* iOS Style: Frosted glass bar with clean SF-style icons */
        <nav
          className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl bg-white/85 dark:bg-[#161b26]/90 border-t border-slate-200/60 dark:border-slate-800/70 pb-[max(14px,env(safe-area-inset-bottom))] pt-2.5 transition-colors duration-200 select-none shadow-[0_-4px_24px_rgba(0,0,0,0.04)]"
        >
          <div className="max-w-md mx-auto grid grid-cols-5 items-center px-2">
            {/* Vaults Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('/my-vault')}
              className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors ${
                isVaultActive
                  ? 'text-[#007aff] dark:text-[#0a84ff]'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Shield size={21} strokeWidth={isVaultActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold tracking-tight">Vaults</span>
            </button>

            {/* Shared Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('/shared-with-me')}
              className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors ${
                isSharedActive
                  ? 'text-[#007aff] dark:text-[#0a84ff]'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Users size={21} strokeWidth={isSharedActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold tracking-tight">Shared</span>
            </button>

            {/* Generator Tab */}
            <button
              type="button"
              onClick={handleOpenGenerator}
              className="flex flex-col items-center justify-center gap-1 py-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <Sparkles size={21} strokeWidth={2} />
              <span className="text-[10px] font-semibold tracking-tight">Generate</span>
            </button>

            {/* Security Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('/security/password-health')}
              className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors ${
                isHealthActive
                  ? 'text-[#007aff] dark:text-[#0a84ff]'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <ShieldCheck size={21} strokeWidth={isHealthActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold tracking-tight">Health</span>
            </button>

            {/* Settings Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('/profile')}
              className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors ${
                isSettingsActive
                  ? 'text-[#007aff] dark:text-[#0a84ff]'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Settings size={21} strokeWidth={isSettingsActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold tracking-tight">Settings</span>
            </button>
          </div>
        </nav>
      ) : (
        /* Android Style: Material 3 Navigation Bar with tonal pill indicator */
        <nav
          className="fixed bottom-0 inset-x-0 z-30 bg-[#f1f4f9] dark:bg-[#1a1c23] border-t border-slate-200/50 dark:border-slate-800/60 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 select-none shadow-[0_-2px_12px_rgba(0,0,0,0.05)]"
        >
          <div className="max-w-md mx-auto grid grid-cols-5 items-center px-1">
            {/* Vaults Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('/my-vault')}
              className="flex flex-col items-center justify-center gap-1 py-0.5"
            >
              <div
                className={`flex items-center justify-center px-4 py-1 rounded-full transition-all duration-200 ${
                  isVaultActive
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Shield size={20} strokeWidth={isVaultActive ? 2.5 : 2} />
              </div>
              <span
                className={`text-[11px] leading-tight ${
                  isVaultActive
                    ? 'font-bold text-slate-900 dark:text-slate-100'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                Vaults
              </span>
            </button>

            {/* Shared Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('/shared-with-me')}
              className="flex flex-col items-center justify-center gap-1 py-0.5"
            >
              <div
                className={`flex items-center justify-center px-4 py-1 rounded-full transition-all duration-200 ${
                  isSharedActive
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Users size={20} strokeWidth={isSharedActive ? 2.5 : 2} />
              </div>
              <span
                className={`text-[11px] leading-tight ${
                  isSharedActive
                    ? 'font-bold text-slate-900 dark:text-slate-100'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                Shared
              </span>
            </button>

            {/* Generator Tab */}
            <button
              type="button"
              onClick={handleOpenGenerator}
              className="flex flex-col items-center justify-center gap-1 py-0.5"
            >
              <div className="flex items-center justify-center px-4 py-1 rounded-full text-slate-500 dark:text-slate-400">
                <Sparkles size={20} strokeWidth={2} />
              </div>
              <span className="text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                Generator
              </span>
            </button>

            {/* Security Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('/security/password-health')}
              className="flex flex-col items-center justify-center gap-1 py-0.5"
            >
              <div
                className={`flex items-center justify-center px-4 py-1 rounded-full transition-all duration-200 ${
                  isHealthActive
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <ShieldCheck size={20} strokeWidth={isHealthActive ? 2.5 : 2} />
              </div>
              <span
                className={`text-[11px] leading-tight ${
                  isHealthActive
                    ? 'font-bold text-slate-900 dark:text-slate-100'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                Health
              </span>
            </button>

            {/* Settings Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('/profile')}
              className="flex flex-col items-center justify-center gap-1 py-0.5"
            >
              <div
                className={`flex items-center justify-center px-4 py-1 rounded-full transition-all duration-200 ${
                  isSettingsActive
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Settings size={20} strokeWidth={isSettingsActive ? 2.5 : 2} />
              </div>
              <span
                className={`text-[11px] leading-tight ${
                  isSettingsActive
                    ? 'font-bold text-slate-900 dark:text-slate-100'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                Settings
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* Quick Password Generator Modal */}
      {generatorOpen && (
        <PasswordGeneratorModal
          open={generatorOpen}
          onClose={() => setGeneratorOpen(false)}
        />
      )}
    </>
  );
}
