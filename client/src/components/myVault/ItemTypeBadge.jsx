import {
  CreditCard,
  KeyRound,
  Landmark,
  Shield,
  StickyNote,
  Terminal,
  KeySquare,
  Database,
  Wifi,
  FileBadge,
  Hash,
} from 'lucide-react';
import { getItemTypeMeta } from '../../utils/itemTypes';

const TYPE_ICONS = {
  LOGIN: KeyRound,
  CARD: CreditCard,
  BANK_ACCOUNT: Landmark,
  IDENTITY: Shield,
  SECURE_NOTE: StickyNote,
  SSH_KEY: Terminal,
  API_TOKEN: KeySquare,
  DATABASE: Database,
  WIFI: Wifi,
  LICENSE: FileBadge,
  RECOVERY_CODE: Hash,
};

const TYPE_STYLES = {
  LOGIN: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
  CARD: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  BANK_ACCOUNT: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
  IDENTITY: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  SECURE_NOTE: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  SSH_KEY: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
  API_TOKEN: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400',
  DATABASE: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400',
  WIFI: 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400',
  LICENSE: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  RECOVERY_CODE: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
};

function ItemTypeBadge({ type }) {
  const meta = getItemTypeMeta(type);
  const Icon = TYPE_ICONS[type] || KeyRound;
  const style = TYPE_STYLES[type] || TYPE_STYLES.LOGIN;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${style}`}>
      <Icon size={12} />
      {meta.label}
    </span>
  );
}

export default ItemTypeBadge;
