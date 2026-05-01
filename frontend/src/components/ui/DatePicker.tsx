import { useEffect, useId, useState } from 'react';
import { cn } from '../../lib/cn';
import { daysInMonth, toIsoDate } from '../../lib/format';
import { ChevronDownIcon } from './Icon';

export interface DatePickerProps {
  label?: string;
  value: string | null;
  setValue: (iso: string | null) => void;
  error?: string | null;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
}

function parseIso(value: string | null): { year: number | null; month: number | null; day: number | null } {
  if (!value) return { year: null, month: null, day: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return { year: null, month: null, day: null };
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function DatePicker({
  label,
  value,
  setValue,
  error,
  disabled,
  minYear = 1920,
  maxYear,
}: DatePickerProps) {
  const baseId = useId();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const effectiveMaxYear = maxYear ?? currentYear;

  const parsed = parseIso(value);
  const [year, setYear] = useState<number | null>(parsed.year);
  const [month, setMonth] = useState<number | null>(parsed.month);
  const [day, setDay] = useState<number | null>(parsed.day);

  useEffect(() => {
    const p = parseIso(value);
    setYear(p.year);
    setMonth(p.month);
    setDay(p.day);
  }, [value]);

  const years: number[] = [];
  for (let y = effectiveMaxYear; y >= minYear; y--) years.push(y);

  const maxMonth = year === currentYear ? currentMonth : 12;
  const dayCount = year && month ? daysInMonth(year, month) : 31;
  const maxDay = year === currentYear && month === currentMonth ? currentDay : dayCount;

  const emitIfComplete = (nextYear: number | null, nextMonth: number | null, nextDay: number | null) => {
    if (nextYear && nextMonth && nextDay) {
      const safeDay = Math.min(nextDay, daysInMonth(nextYear, nextMonth));
      const iso = toIsoDate(nextYear, nextMonth, safeDay);
      const d = new Date(iso);
      if (d > today) {
        setValue(null);
        return;
      }
      setValue(iso);
    } else if (value !== null) {
      setValue(null);
    }
  };

  const handleYear = (v: string) => {
    const nextYear = v ? Number(v) : null;
    setYear(nextYear);
    let nextMonth = month;
    let nextDay = day;
    if (nextYear === currentYear && month && month > currentMonth) {
      nextMonth = null;
      nextDay = null;
      setMonth(null);
      setDay(null);
    }
    emitIfComplete(nextYear, nextMonth, nextDay);
  };

  const handleMonth = (v: string) => {
    const nextMonth = v ? Number(v) : null;
    setMonth(nextMonth);
    let nextDay = day;
    if (year && nextMonth && day) {
      const maxDays = daysInMonth(year, nextMonth);
      if (day > maxDays) {
        nextDay = null;
        setDay(null);
      }
    }
    emitIfComplete(year, nextMonth, nextDay);
  };

  const handleDay = (v: string) => {
    const nextDay = v ? Number(v) : null;
    setDay(nextDay);
    emitIfComplete(year, month, nextDay);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <div className="grid grid-cols-3 gap-2">
        <NativeSelect
          id={`${baseId}-year`}
          label="Year"
          value={year ?? ''}
          disabled={disabled}
          hasError={Boolean(error)}
          setValue={handleYear}
        >
          <option value="" disabled>
            Year
          </option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          id={`${baseId}-month`}
          label="Month"
          value={month ?? ''}
          disabled={disabled || !year}
          hasError={Boolean(error)}
          setValue={handleMonth}
        >
          <option value="" disabled>
            Month
          </option>
          {MONTHS.map((name, idx) => {
            const m = idx + 1;
            return (
              <option key={m} value={m} disabled={m > maxMonth}>
                {name}
              </option>
            );
          })}
        </NativeSelect>

        <NativeSelect
          id={`${baseId}-day`}
          label="Day"
          value={day ?? ''}
          disabled={disabled || !month || !year}
          hasError={Boolean(error)}
          setValue={handleDay}
        >
          <option value="" disabled>
            Day
          </option>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </NativeSelect>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

interface NativeSelectProps {
  id: string;
  label: string;
  value: number | string;
  disabled?: boolean;
  hasError?: boolean;
  setValue: (v: string) => void;
  children: React.ReactNode;
}

function NativeSelect({ id, label, value, disabled, hasError, setValue, children }: NativeSelectProps) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        disabled={disabled}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(
          'h-10 w-full appearance-none rounded-md border bg-white pl-3 pr-8 text-sm text-neutral-900',
          'focus:outline-none focus:ring-2 focus:ring-primary-200',
          hasError ? 'border-danger focus:border-danger' : 'border-neutral-300 focus:border-primary-500',
          disabled && 'cursor-not-allowed bg-neutral-100 text-neutral-400',
        )}
      >
        {children}
      </select>
      <ChevronDownIcon
        size={14}
        className="pointer-events-none absolute inset-y-0 right-2 my-auto text-neutral-400"
      />
    </div>
  );
}
