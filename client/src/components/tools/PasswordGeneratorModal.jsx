import { useState, useEffect, useCallback } from 'react';
import { X, Copy, RefreshCw, Check, Sparkles, Eye, EyeOff } from 'lucide-react';
import { generatePassword } from '../../utils/passwordGenerator';
import { getPasswordStrength } from '../../utils/passwordStrength';
import { secureCopyText } from '../../utils/clipboard';
import ModalPortal from '../common/ModalPortal';

const MIN_LENGTH = 8;
const MAX_LENGTH = 64;

const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-indigo-500/30';

function PasswordGeneratorModal({ open, onClose }) {
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [length, setLength] = useState(20);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);

  const generate = useCallback(() => {
    const pw = generatePassword({
      length,
      useUppercase,
      useLowercase,
      useNumbers,
      useSymbols,
      excludeAmbiguous,
    });
    setPassword(pw);
    setCopied(false);
  }, [length, useUppercase, useLowercase, useNumbers, useSymbols, excludeAmbiguous]);

  useEffect(() => {
    if (open) generate();
  }, [open, generate]);

  const hasSelection = useUppercase || useLowercase || useNumbers || useSymbols;
  const strength = hasSelection ? getPasswordStrength(password) : null;

  const strengthConfig = {
    Weak: { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200', label: 'Weak' },
    Medium: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200', label: 'Medium' },
    Strong: { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200', label: 'Strong' },
  };

  const strengthPercent = strength
    ? strength.label === 'Strong' ? 100 : strength.label === 'Medium' ? 60 : 30
    : 0;

  const handleCopy = () => {
    secureCopyText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <ModalPortal open={open} onClose={onClose}>
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center dark:bg-indigo-900/50">
              <Sparkles size={20} className="text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Password Generator</h2>
              <p className="text-sm text-slate-500 mt-0.5 dark:text-slate-400">Create strong, secure passwords instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-slate-100 flex items-center justify-center dark:hover:bg-slate-700"
          >
            <X size={19} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {!hasSelection && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-700 dark:text-amber-400">Select at least one character type</p>
          </div>
        )}

        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  readOnly
                  className={`${inputClass} pr-10 text-base`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <button
                onClick={handleCopy}
                className={`h-[42px] w-[42px] rounded-lg flex items-center justify-center transition shrink-0 ${
                  copied ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                }`}
                title="Copy to clipboard"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
              <button
                onClick={generate}
                className="h-[42px] w-[42px] rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 flex items-center justify-center shrink-0 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-800/50"
                title="Generate new password"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            {strength && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strengthConfig[strength.label].bar}`}
                    style={{ width: `${strengthPercent}%` }}
                  />
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${strengthConfig[strength.label].bg} ${strengthConfig[strength.label].text}`}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 dark:bg-slate-700/50 dark:border-slate-600">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password length</label>
              <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md dark:text-indigo-300 dark:bg-indigo-900/50">{length}</span>
            </div>
            <input
              type="range"
              min={MIN_LENGTH}
              max={MAX_LENGTH}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600 dark:bg-slate-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1 dark:text-slate-500">
              <span>{MIN_LENGTH}</span>
              <span>{MAX_LENGTH}</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2.5 dark:text-slate-300">Character types</p>
            <div className="grid grid-cols-2 gap-2.5">
              <CharToggle checked={useUppercase} onChange={setUseUppercase} label="A-Z" sub="Uppercase" />
              <CharToggle checked={useLowercase} onChange={setUseLowercase} label="a-z" sub="Lowercase" />
              <CharToggle checked={useNumbers} onChange={setUseNumbers} label="0-9" sub="Numbers" />
              <CharToggle checked={useSymbols} onChange={setUseSymbols} label="!@#" sub="Symbols" />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setExcludeAmbiguous(!excludeAmbiguous)}
              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                excludeAmbiguous ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                  excludeAmbiguous ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </div>
            <div>
              <span className="text-sm text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100">Exclude ambiguous characters</span>
              <p className="text-xs text-slate-400 dark:text-slate-500">i, l, 1, L, o, 0, O</p>
            </div>
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy Password'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}

function CharToggle({ checked, onChange, label, sub }) {
  return (
    <label
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 px-3.5 py-3 rounded-lg border cursor-pointer transition select-none ${
        checked ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700'
      }`}
    >
      <div
        className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition shrink-0 ${
          checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-500'
        }`}
      >
        {checked && <Check size={11} className="text-white" />}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-800 leading-tight dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>
      </div>
    </label>
  );
}

export default PasswordGeneratorModal;
