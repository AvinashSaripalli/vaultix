import { useEffect, useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { generateTOTP } from '../../utils/crypto';

function TotpField({ secret, revealed, onReveal, onCopy }) {
  const [totp, setTotp] = useState(null);

  useEffect(() => {
    if (!revealed || !secret) return undefined;

    let cancelled = false;

    const tick = () => {
      generateTOTP(secret).then((result) => {
        if (!cancelled && result) {
          setTotp({ secret, code: result.code, secondsRemaining: result.secondsRemaining });
        }
      });
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [revealed, secret]);

  const currentCode = totp && totp.secret === secret ? totp : null;

  return (
    <div className="border-b border-slate-200 py-3.5 sm:py-5 dark:border-slate-700 min-w-0">
      <div className="grid grid-cols-[100px_1fr_auto] sm:grid-cols-[130px_1fr_auto] gap-2 items-center min-w-0">
        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Authenticator</p>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <p className="text-base sm:text-lg tracking-widest text-slate-900 truncate dark:text-slate-100 font-mono">
            {revealed && currentCode ? currentCode.code : '••••••'}
          </p>
          {revealed && currentCode && (
            <span
              className={`text-xs shrink-0 ${
                currentCode.secondsRemaining <= 5
                  ? 'text-red-500 font-bold'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {currentCode.secondsRemaining}s
            </span>
          )}
        </div>
        <div className="flex justify-end items-center gap-2 shrink-0">
          <button
            onClick={onReveal}
            title={revealed ? 'Hide code' : 'Show code'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition"
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            onClick={onCopy}
            title="Copy code"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition"
          >
            <Copy size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TotpField;
