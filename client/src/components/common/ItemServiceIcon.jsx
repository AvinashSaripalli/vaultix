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

export default function ItemServiceIcon({ name = '', type = 'LOGIN', size = 'md', className = '' }) {
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
    sm: 'w-8 h-8 rounded-xl text-xs',
    md: 'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl text-sm sm:text-base font-bold shadow-xs',
    lg: 'w-14 h-14 sm:w-16 sm:h-16 rounded-3xl text-xl sm:text-2xl font-extrabold shadow-md',
  }[size] || 'w-10 h-10 rounded-2xl text-sm font-bold';

  const iconSize = size === 'lg' ? 26 : size === 'sm' ? 14 : 18;

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
