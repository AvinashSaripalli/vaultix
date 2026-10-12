import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';

function CustomFieldsInput({ fields, onChange, inputClass }) {
  const [revealed, setRevealed] = useState({});

  const updateField = (index, key, value) => {
    const next = fields.map((field, i) => (i === index ? { ...field, [key]: value } : field));
    onChange(next);
  };

  const addField = () => {
    onChange([...(fields || []), { name: '', value: '', sensitive: false }]);
  };

  const removeField = (index) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Custom Fields <span className="text-slate-400 dark:text-slate-500">(optional)</span>
        </label>
        <button
          type="button"
          onClick={addField}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <Plus size={14} />
          Add Field
        </button>
      </div>

      {(fields || []).length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Add extra key/value pairs like employee ID, team, or project reference.
        </p>
      )}

      {(fields || []).map((field, index) => {
        const isRevealed = revealed[index];
        const type = field.sensitive && !isRevealed ? 'password' : 'text';
        return (
          <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 sm:p-0 rounded-xl border border-slate-200 sm:border-0 bg-slate-50/50 sm:bg-transparent dark:border-slate-700 dark:bg-slate-800/40 sm:dark:bg-transparent">
            <input
              type="text"
              value={field.name || ''}
              onChange={(e) => updateField(index, 'name', e.target.value)}
              placeholder="Label (e.g. Employee ID)"
              className={`${inputClass} sm:flex-1`}
            />
            <div className="flex items-center gap-1.5 sm:flex-1">
              <input
                type={type}
                value={field.value || ''}
                onChange={(e) => updateField(index, 'value', e.target.value)}
                placeholder="Value"
                className={`${inputClass} flex-1 min-w-0`}
              />
              <button
                type="button"
                onClick={() => setRevealed((prev) => ({ ...prev, [index]: !prev[index] }))}
                disabled={!field.sensitive}
                className={`p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 shrink-0 ${!field.sensitive ? 'opacity-30 cursor-not-allowed' : ''}`}
                title={field.sensitive ? 'Toggle reveal' : 'Mark field as sensitive to enable reveal'}
              >
                {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRevealed((prev) => {
                    const next = { ...prev };
                    delete next[index];
                    return next;
                  });
                  removeField(index);
                }}
                className="p-2 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 shrink-0"
                title="Remove field"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CustomFieldsInput;