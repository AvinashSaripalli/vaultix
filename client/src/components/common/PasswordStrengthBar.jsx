import { useMemo } from 'react';
import { getPasswordStrength } from '../../utils/passwordStrength';

const SEGMENT_COLORS = {
  1: 'bg-rose-500',
  2: 'bg-amber-500',
  3: 'bg-indigo-500',
  4: 'bg-emerald-500',
};

const LABEL_COLORS = {
  Weak: 'text-rose-600 dark:text-rose-400',
  Medium: 'text-amber-600 dark:text-amber-400',
  Good: 'text-indigo-600 dark:text-indigo-400',
  Strong: 'text-emerald-600 dark:text-emerald-400',
};

export default function PasswordStrengthBar({ password, showTip = true }) {
  const strength = useMemo(() => {
    if (!password) return null;
    return getPasswordStrength(password);
  }, [password]);

  if (!password || !strength) return null;

  const activeScore = strength.score || (strength.label === 'Strong' ? 4 : strength.label === 'Good' ? 3 : strength.label === 'Medium' ? 2 : 1);
  const activeColor = SEGMENT_COLORS[activeScore] || 'bg-rose-500';
  const labelColor = LABEL_COLORS[strength.label] || 'text-slate-600';

  return (
    <div className="mt-2 space-y-1.5" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Password strength</span>
        <span className={`font-semibold ${labelColor}`}>{strength.label}</span>
      </div>

      {/* 4 Distinct Segments */}
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              seg <= activeScore
                ? activeColor
                : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>

      {showTip && strength.tip && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {strength.tip}
        </p>
      )}
    </div>
  );
}
