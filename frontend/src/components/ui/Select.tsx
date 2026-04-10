import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { cn } from '../../lib/cn';
import type { SelectOption } from '../../types/ui';
import { ChevronDownIcon, SearchIcon, CheckIcon } from './Icon';

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
  id?: string;
  name?: string;
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(function Select(
  { label, options, value, onChange, placeholder = 'Select...', error, disabled, id, name },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const useCombobox = options.length >= 8;

  if (!useCombobox) {
    return (
      <div ref={ref} className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            name={name}
            disabled={disabled}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'h-10 w-full appearance-none rounded-md border bg-white pl-3 pr-9 text-sm text-neutral-900',
              'focus:outline-none focus:ring-2 focus:ring-primary-200',
              error ? 'border-danger focus:border-danger' : 'border-neutral-300 focus:border-primary-500',
              disabled && 'cursor-not-allowed bg-neutral-100 text-neutral-400',
            )}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {groupOptions(options)}
          </select>
          <ChevronDownIcon
            size={16}
            className="pointer-events-none absolute inset-y-0 right-3 my-auto text-neutral-400"
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <Combobox
      label={label}
      id={selectId}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      error={error}
      disabled={disabled}
    />
  );
});

function groupOptions(options: SelectOption[]) {
  const groups = new Map<string, SelectOption[]>();
  for (const opt of options) {
    const key = opt.group ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(opt);
  }
  const nodes: JSX.Element[] = [];
  let keyCounter = 0;
  for (const [group, opts] of groups) {
    if (group) {
      nodes.push(
        <optgroup key={`g-${keyCounter++}`} label={group}>
          {opts.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </optgroup>,
      );
    } else {
      for (const o of opts) {
        nodes.push(
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>,
        );
      }
    }
  }
  return nodes;
}

interface ComboboxProps {
  label?: string;
  id: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string | null;
  disabled?: boolean;
}

function Combobox({ label, id, options, value, onChange, placeholder, error, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, SelectOption[]>();
    for (const o of filtered) {
      const k = o.group ?? '';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(o);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const choice = filtered[activeIndex];
      if (choice) {
        onChange(choice.value);
        setOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-md border bg-white px-3 text-sm transition-colors',
          error ? 'border-danger' : 'border-neutral-300',
          disabled && 'cursor-not-allowed bg-neutral-100',
          open && !error && 'border-primary-500 ring-2 ring-primary-200',
        )}
      >
        <SearchIcon size={16} className="text-neutral-400" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          disabled={disabled}
          className="h-full flex-1 bg-transparent outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
          placeholder={selected ? selected.label : placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <ChevronDownIcon size={16} className="text-neutral-400" />
      </div>
      {open && filtered.length > 0 && (
        <ul
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-neutral-200 bg-white shadow-elevation-2"
        >
          {grouped.map(([group, opts]) => (
            <li key={group || 'default'}>
              {group && (
                <div className="bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {group}
                </div>
              )}
              <ul>
                {opts.map((opt) => {
                  const index = filtered.indexOf(opt);
                  const isActive = index === activeIndex;
                  const isSelected = opt.value === value;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={cn(
                        'flex cursor-pointer items-center justify-between px-3 py-2 text-sm',
                        isActive ? 'bg-primary-50 text-primary-600' : 'text-neutral-700',
                      )}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <CheckIcon size={14} className="text-primary-500" />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute top-full z-20 mt-1 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-500 shadow-elevation-2">
          No results
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
