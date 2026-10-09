import { useMemo } from 'react';
import { getPasswordStrength } from '../../utils/passwordStrength';

export default function PasswordStrengthBar({ password }) {
  const strength = useMemo(() => {
    if (!password) return null;
    return getPasswordStrength(password);
  }, [password]);

  if (!password) return null;

  const getScoreWidth = () => {
    if (strength.label === 'Strong') return 'w-full bg-emerald-500';
    if (strength.label === 'Medium') return 'w-2/3 bg-amber-500';
    return 'w-1/3 bg-rose-500';
  };

  const getLabelColor = () => {
    if (strength.label === 'Strong') return 'text-emerald-600 dark:text-emerald-400';
    if (strength.label === 'Medium') return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="text-slate-400 dark:text-slate-500">Password strength</span>
        <span className={getLabelColor()}>{strength.label}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${getScoreWidth()}`}
        />
      </div>
    </div>
  );
}
