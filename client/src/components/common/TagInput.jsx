import { useState, useRef, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { X, Plus, Tag as TagIcon, Check, ChevronDown, Sparkles } from 'lucide-react';
import {
  DEPARTMENT_TAG_GROUPS,
  ALL_DEPARTMENT_TAGS,
  getDefaultDepartmentForType,
  getQuickSuggestedTagsForType,
} from '../../utils/departmentTags';

function TagInput({
  tags = [],
  setTags,
  onChange,
  itemType,
  suggestions: externalSuggestions,
}) {
  const [input, setInput] = useState('');
  const [openDropdown, setOpenDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    getDefaultDepartmentForType(itemType)
  );
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const handleTagsChange = setTags || onChange;

  // Retrieve existing tags already used in the user's vaults for personalization
  const existingVaultTags = useSelector((state) => {
    const v1 = state.vault?.passwords || [];
    const v2 = state.myVault?.passwords || [];
    const set = new Set();
    [...v1, ...v2].forEach((item) => {
      (item.tags || []).forEach((t) => {
        const name = typeof t === 'string' ? t : t?.tag?.name;
        if (name && name.trim()) set.add(name.trim());
      });
    });
    return Array.from(set);
  });

  // Keep active category aligned when itemType changes
  useEffect(() => {
    if (itemType) {
      setActiveTab(getDefaultDepartmentForType(itemType));
    }
  }, [itemType]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    } else if (e.key === 'Escape') {
      setOpenDropdown(false);
    }
  };

  // Top 4-5 smart suggestions for quick 1-click addition directly under the input
  const topQuickSuggestions = useMemo(() => {
    const smartList = getQuickSuggestedTagsForType(itemType);
    return smartList
      .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
      .slice(0, 5);
  }, [itemType, tags]);

  // Combined master list of suggestions for search and browsing
  const masterSuggestions = useMemo(() => {
    const combined = [
      ...existingVaultTags,
      ...(externalSuggestions || ALL_DEPARTMENT_TAGS),
    ];
    return Array.from(new Set(combined));
  }, [existingVaultTags, externalSuggestions]);

  // Filtered list when user is typing in the search box
  const searchResults = useMemo(() => {
    if (!input.trim()) return [];
    return masterSuggestions.filter((s) =>
      s.toLowerCase().includes(input.toLowerCase().trim())
    );
  }, [input, masterSuggestions]);

  // Tags for the active tab inside the popover
  const currentTabTags = useMemo(() => {
    if (activeTab === 'vault') {
      return existingVaultTags.length > 0 ? existingVaultTags : masterSuggestions.slice(0, 15);
    }
    if (activeTab === 'all') {
      return masterSuggestions;
    }
    const group = DEPARTMENT_TAG_GROUPS.find((g) => g.id === activeTab);
    return group ? group.tags : masterSuggestions;
  }, [activeTab, existingVaultTags, masterSuggestions]);

  const hasTypedExactMatch = tags.some((t) => t.toLowerCase() === input.trim().toLowerCase());

  return (
    <div ref={containerRef} className="space-y-1.5">
      {/* Clean Tag Input Container */}
      <div className="relative">
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex flex-wrap items-center gap-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-700/80 rounded-xl px-3 py-2 min-h-[46px] focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30 transition cursor-text bg-white"
        >
          {/* Selected Tag Badges */}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-medium border border-indigo-200/80 dark:border-indigo-800"
            >
              <TagIcon size={11} className="text-indigo-500 dark:text-indigo-400" />
              <span className="truncate max-w-[200px]">{tag}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                aria-label={`Remove tag ${tag}`}
                className="hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-600 dark:text-indigo-300 rounded-full p-0.5 transition"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setOpenDropdown(true);
            }}
            onFocus={() => setOpenDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? 'Type to add or search tags...' : 'Add more...'}
            className="flex-1 min-w-[130px] border-none outline-none text-sm bg-transparent py-1 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />

          {/* Suggestions Dropdown Trigger Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdown((prev) => !prev);
            }}
            className="text-xs font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 select-none"
            title="Browse tag suggestions"
          >
            <span>Browse</span>
            <ChevronDown size={13} className={`transition-transform duration-200 ${openDropdown ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Floating Popover Dropdown (Clean, Zero Form Clutter) */}
        {openDropdown && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
            {/* When typing a custom tag */}
            {input.trim() ? (
              <div className="p-2 space-y-1">
                {!hasTypedExactMatch && (
                  <button
                    type="button"
                    onClick={() => {
                      addTag(input);
                      setOpenDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Plus size={13} className="shrink-0" />
                      Create tag <strong className="underline font-bold">"{input.trim()}"</strong>
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200">Enter ↵</span>
                  </button>
                )}

                {searchResults.length > 0 && (
                  <div className="pt-1.5">
                    <p className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Matching Tags
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {searchResults.map((s) => {
                        const isAdded = tags.some((t) => t.toLowerCase() === s.toLowerCase());
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => (isAdded ? removeTag(s) : addTag(s))}
                            className={`w-full text-left px-3 py-2 text-xs rounded-lg transition flex items-center justify-between ${
                              isAdded
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                            }`}
                          >
                            <span>{s}</span>
                            {isAdded ? (
                              <Check size={13} className="text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Plus size={13} className="text-slate-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* When browsing by category / department inside the popover */
              <div>
                {/* Sleek Tabs Header (No ugly horizontal scrollbar) */}
                <div className="flex items-center gap-1 p-2 bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {existingVaultTags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('vault')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                        activeTab === 'vault'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      ★ Vault Tags
                    </button>
                  )}
                  {DEPARTMENT_TAG_GROUPS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setActiveTab(g.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                        activeTab === g.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      activeTab === 'all'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    All
                  </button>
                </div>

                {/* Tags Grid inside Popover */}
                <div className="p-2.5 max-h-48 overflow-y-auto">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {currentTabTags.map((tag) => {
                      const isAdded = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => (isAdded ? removeTag(tag) : addTag(tag))}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                            isAdded
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700'
                              : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-300'
                          }`}
                        >
                          {isAdded ? (
                            <Check size={11} className="text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Plus size={11} className="text-slate-400" />
                          )}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtle 1-Line Quick Suggestions (Zero Clutter, Zero Scrollbar) */}
      {topQuickSuggestions.length > 0 && !openDropdown && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
            <Sparkles size={11} className="text-amber-500" /> Suggested:
          </span>
          {topQuickSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 hover:border-indigo-300 dark:hover:border-indigo-700 border border-transparent transition text-xs font-normal"
            >
              <Plus size={10} className="text-slate-400" />
              <span>{tag}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpenDropdown(true)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium ml-1"
          >
            More ▾
          </button>
        </div>
      )}
    </div>
  );
}

export default TagInput;
