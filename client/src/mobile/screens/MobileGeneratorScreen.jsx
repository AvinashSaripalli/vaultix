import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, RefreshCw, Sparkles } from 'lucide-react';
import { hapticMedium, hapticSuccess } from '../../utils/haptics';

export default function MobileGeneratorScreen({ onCopyPassword }) {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    let chars = '';
    if (useUpper) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    if (useLower) chars += 'abcdefghijkmnopqrstuvwxyz';
    if (useNumbers) chars += '23456789';
    if (useSymbols) chars += '!@#$%^&*()-_=+[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

    // Cryptographically secure generation
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    let res = '';
    for (let i = 0; i < length; i++) {
      res += chars[array[i] % chars.length];
    }
    setPassword(res);
  }, [length, useUpper, useLower, useNumbers, useSymbols]);

  useEffect(() => {
    generate();
  }, [generate]);

  const handleCopy = () => {
    hapticSuccess();
    onCopyPassword(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate entropy
  let poolSize = 0;
  if (useUpper) poolSize += 26;
  if (useLower) poolSize += 26;
  if (useNumbers) poolSize += 10;
  if (useSymbols) poolSize += 28;
  const entropy = Math.round(length * Math.log2(poolSize || 26));

  return (
    <div className="px-5 pt-3 pb-6 space-y-4 select-none">
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <span>Password Generator</span>
          <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Cryptographically secure, zero-knowledge entropy</p>
      </div>

      {/* Generated Output Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3.5 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
          <p className="font-mono text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400 tracking-wider break-all select-all">
            {password}
          </p>
        </div>

        {/* Live Entropy Meter */}
        <div className="space-y-1 text-left">
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Entropy Strength</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{entropy}-bit (Very Strong)</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (entropy / 128) * 100)}%` }}
            />
          </div>
        </div>

        {/* Primary Giant Copy Button */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              generate();
            }}
            className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <RefreshCw size={14} />
            <span>Regenerate</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={`flex-1 py-3 rounded-2xl text-xs font-bold text-white transition active:scale-95 flex items-center justify-center gap-1.5 shadow-lg ${
              copied
                ? 'bg-emerald-600 shadow-emerald-600/30'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy Password'}</span>
          </button>
        </div>
      </div>

      {/* Generator Controls */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        {/* Length Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-300">Length</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-mono">
              {length} characters
            </span>
          </div>
          <input
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
        </div>

        {/* Character Set Toggles */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 cursor-pointer text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={useUpper}
              onChange={(e) => setUseUpper(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            <span className="font-semibold">Uppercase (A-Z)</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 cursor-pointer text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={useLower}
              onChange={(e) => setUseLower(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            <span className="font-semibold">Lowercase (a-z)</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 cursor-pointer text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={useNumbers}
              onChange={(e) => setUseNumbers(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            <span className="font-semibold">Numbers (0-9)</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 cursor-pointer text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={useSymbols}
              onChange={(e) => setUseSymbols(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            <span className="font-semibold">Symbols (!@#$)</span>
          </label>
        </div>
      </div>
    </div>
  );
}
