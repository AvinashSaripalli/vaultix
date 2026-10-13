import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

const DEFAULT_SUGGESTIONS = [
  'Production', 'Testing', 'Development', 'Shared', 'Private',
  'Critical', 'Client', 'Internal', 'Cloud', 'CRM', 'Hosting',
  'Email', 'Database', 'Security', 'Marketing', 'Finance',
  'Support', 'Temporary',
];

function TagInput({ tags = [], setTags, onChange, suggestions: externalSuggestions }) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const handleTagsChange = setTags || onChange;

  const suggestions = (externalSuggestions || DEFAULT_SUGGESTIONS).filter(
    (s) =>
      s.toLowerCase().includes(input.toLowerCase()) &&
      !tags.some((t) => t.toLowerCase() === s.toLowerCase())
  ).slice(0, 8);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addTag = (value) => {
    const clean = value.trim();
    if (!clean) return;
    if (tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setInput('');
      return;
    }
    handleTagsChange?.([...tags, clean]);
    setInput('');
  };

  const removeTag = (tag) => {
    handleTagsChange?.(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl px-3 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition min-h-[46px]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-full p-0.5"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          placeholder={tags.length === 0 ? 'Type to search or add tags...' : ''}
          className="flex-1 min-w-[120px] border-none outline-none text-sm bg-transparent py-1"
        />
      </div>

      {focused && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-400 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TagInput;