import { Crown, Shield, User } from 'lucide-react';
import { ROLES, getRoleLabel } from '../../utils/roles';

export default function RoleBadge({ role, size = 'sm', showIcon = true }) {
  const isSm = size === 'sm';
  const iconSize = isSm ? 12 : 14;

  if (role === ROLES.SUPER_ADMIN) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full border transition-colors shadow-2xs ${
          isSm ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        } bg-amber-50 text-amber-800 border-amber-300/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60`}
      >
        {showIcon && <Crown size={iconSize} className="text-amber-600 dark:text-amber-400 shrink-0" />}
        <span>{getRoleLabel(role)}</span>
      </span>
    );
  }

  if (role === ROLES.ADMIN) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full border transition-colors shadow-2xs ${
          isSm ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        } bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60`}
      >
        {showIcon && <Shield size={iconSize} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
        <span>{getRoleLabel(role)}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors ${
        isSm ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      } bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700`}
    >
      {showIcon && <User size={iconSize} className="text-slate-400 dark:text-slate-500 shrink-0" />}
      <span>{getRoleLabel(role)}</span>
    </span>
  );
}
