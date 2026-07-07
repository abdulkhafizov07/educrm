'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Option { value: string; label: string; }

interface SearchableMultiSelectProps {
  label?: string;
  error?: string;
  options: Option[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

// Multi-pick variant of <SearchableSelect>: type to filter, click to toggle,
// selected items shown as removable chips. The panel expands inline (in flow)
// so it never gets clipped inside a scrollable Modal.
export function SearchableMultiSelect({
  label, error, options, values, onChange, placeholder, required, disabled,
  searchPlaceholder = 'Search…', emptyMessage = 'No results',
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => values.map(v => options.find(o => o.value === v)).filter(Boolean) as Option[],
    [values, options]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Reset search/highlight whenever the panel toggles
  useEffect(() => { setQuery(''); setHighlight(0); }, [open]);
  useEffect(() => { setHighlight(0); }, [query]);

  const toggle = (val: string) => {
    onChange(values.includes(val) ? values.filter(v => v !== val) : [...values, val]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) toggle(filtered[highlight].value); }
  };

  return (
    <div className="flex flex-col gap-1" ref={rootRef}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full px-3 py-2 text-sm border rounded bg-white dark:bg-gray-800 text-left flex items-center justify-between gap-2 min-h-[38px]',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50',
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
        )}
      >
        {selected.length === 0 ? (
          <span className="text-gray-400 truncate">{placeholder || searchPlaceholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1 min-w-0">
            {selected.map(o => (
              <span
                key={o.value}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium max-w-full"
              >
                <span className="truncate">{o.label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); toggle(o.value); }}
                  className="hover:text-blue-900 dark:hover:text-blue-100 p-0.5 shrink-0"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </span>
            ))}
          </span>
        )}
        <svg className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="w-full px-2.5 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-400">{emptyMessage}</div>
            ) : (
              filtered.map((o, i) => {
                const checked = values.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => toggle(o.value)}
                    className={cn('w-full text-left px-3 py-2 text-sm flex items-center gap-2.5',
                      i === highlight ? 'bg-gray-50 dark:bg-gray-700/50' : '',
                      checked ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-900 dark:text-white')}
                  >
                    <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600')}>
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
