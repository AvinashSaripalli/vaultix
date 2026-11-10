import { Home, Shield, Sparkles, ShieldCheck, Settings } from 'lucide-react';
import { getMobilePlatformStyle } from '../context/MobileContext';
import { hapticLight } from '../../utils/haptics';

export default function MobileAppShell({ activeTab, onSelectTab, children, toast }) {
  const platform = getMobilePlatformStyle();
  const isIOS = platform === 'ios';

  const handleTabChange = (tabId) => {
    hapticLight();
    onSelectTab(tabId);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative select-none antialiased">
      {/* Safe Area Top Spacer */}
      <div className="pt-[env(safe-area-inset-top)] bg-slate-950/80 backdrop-blur-md sticky top-0 z-40" />

      {/* Floating Toast Notification Pill */}
      {toast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-xl shadow-emerald-500/25 flex items-center gap-1.5 animate-bounce">
          <span>✓</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Main Content Area with Bottom Padding to clear Tab Bar */}
      <main className="flex-1 overflow-y-auto pb-24 min-w-0">
        {children}
      </main>

      {/* Platform Adaptive Bottom Tab Bar */}
      {isIOS ? (
        /* Apple iOS HIG Frosted Glass Tab Bar */
        <nav className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-2xl bg-slate-950/85 border-t border-slate-800/70 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 select-none shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
          <div className="max-w-md mx-auto grid grid-cols-5 items-center px-2">
            <TabButton
              id="home"
              icon={Home}
              label="Home"
              active={activeTab === 'home'}
              onClick={() => handleTabChange('home')}
              ios
            />
            <TabButton
              id="vaults"
              icon={Shield}
              label="Vaults"
              active={activeTab === 'vaults'}
              onClick={() => handleTabChange('vaults')}
              ios
            />
            <TabButton
              id="generator"
              icon={Sparkles}
              label="Generate"
              active={activeTab === 'generator'}
              onClick={() => handleTabChange('generator')}
              ios
            />
            <TabButton
              id="health"
              icon={ShieldCheck}
              label="Health"
              active={activeTab === 'health'}
              onClick={() => handleTabChange('health')}
              ios
            />
            <TabButton
              id="settings"
              icon={Settings}
              label="Settings"
              active={activeTab === 'settings'}
              onClick={() => handleTabChange('settings')}
              ios
            />
          </div>
        </nav>
      ) : (
        /* Android Material 3 Tonal Indicator Tab Bar */
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 border-t border-slate-800 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 select-none shadow-[0_-2px_16px_rgba(0,0,0,0.4)]">
          <div className="max-w-md mx-auto grid grid-cols-5 items-center px-1">
            <TabButton
              id="home"
              icon={Home}
              label="Home"
              active={activeTab === 'home'}
              onClick={() => handleTabChange('home')}
            />
            <TabButton
              id="vaults"
              icon={Shield}
              label="Vaults"
              active={activeTab === 'vaults'}
              onClick={() => handleTabChange('vaults')}
            />
            <TabButton
              id="generator"
              icon={Sparkles}
              label="Generate"
              active={activeTab === 'generator'}
              onClick={() => handleTabChange('generator')}
            />
            <TabButton
              id="health"
              icon={ShieldCheck}
              label="Health"
              active={activeTab === 'health'}
              onClick={() => handleTabChange('health')}
            />
            <TabButton
              id="settings"
              icon={Settings}
              label="Settings"
              active={activeTab === 'settings'}
              onClick={() => handleTabChange('settings')}
            />
          </div>
        </nav>
      )}
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick, ios }) {
  if (ios) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors active:scale-95 ${
          active
            ? 'text-indigo-400'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
        <span className="text-[10px] font-semibold tracking-tight">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 py-0.5 active:scale-95"
    >
      <div
        className={`flex items-center justify-center px-3.5 py-1 rounded-full transition-all duration-200 ${
          active
            ? 'bg-indigo-600/30 text-indigo-400'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
      </div>
      <span
        className={`text-[10px] leading-tight ${
          active
            ? 'font-bold text-white'
            : 'font-medium text-slate-400'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
