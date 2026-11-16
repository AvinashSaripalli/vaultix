import { CreditCard, Landmark, Terminal, Key, Database, Wifi, FileText, Shield, Globe } from 'lucide-react';

const GRADIENTS = [
  'from-indigo-600 to-blue-600 text-white',
  'from-purple-600 to-indigo-600 text-white',
  'from-emerald-600 to-teal-600 text-white',
  'from-amber-500 to-orange-600 text-white',
  'from-rose-500 to-pink-600 text-white',
  'from-cyan-600 to-blue-600 text-white',
  'from-fuchsia-600 to-purple-600 text-white',
  'from-sky-500 to-indigo-600 text-white',
];

export default function ItemServiceIcon({ name = '', type = 'LOGIN', size = 'sm', className = '' }) {
  const cleanName = (name || '').trim();
  const firstLetter = (cleanName[0] || 'V').toUpperCase();

  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = (hash << 5) - hash + cleanName.charCodeAt(i);
    hash |= 0;
  }
  const colorIndex = Math.abs(hash) % GRADIENTS.length;
  const gradient = GRADIENTS[colorIndex];

  const sizeClasses = {
    xs: 'w-6 h-6 rounded-md text-[11px] font-bold',
    sm: 'w-8 h-8 rounded-xl text-xs sm:text-sm font-bold',
    md: 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold shadow-xs',
    lg: 'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl text-lg sm:text-xl font-bold shadow-md',
  }[size] || 'w-8 h-8 rounded-xl text-xs sm:text-sm font-bold';

  const iconSize = size === 'lg' ? 22 : size === 'md' ? 18 : size === 'sm' ? 15 : size === 'xs' ? 12 : 15;

  const renderIcon = () => {
    switch (type) {
      case 'CARD':
        return <CreditCard size={iconSize} />;
      case 'BANK_ACCOUNT':
        return <Landmark size={iconSize} />;
      case 'SSH_KEY':
        return <Terminal size={iconSize} />;
      case 'API_TOKEN':
        return <Key size={iconSize} />;
      case 'DATABASE':
        return <Database size={iconSize} />;
      case 'WIFI':
        return <Wifi size={iconSize} />;
      case 'SECURE_NOTE':
        return <FileText size={iconSize} />;
      default:
        return <span>{firstLetter}</span>;
    }
  };

  return (
    <div
      className={`${sizeClasses} bg-gradient-to-tr ${gradient} flex items-center justify-center shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {renderIcon()}
    </div>
  );
}
