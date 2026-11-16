'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Calendar, ChevronDown, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { formatDisplayDate, parseDateValue, getTodayDateValue } from '@/lib/date-utils';

export interface DateRangeValue {
  from: string; // YYYY-MM-DD or ''
  to: string;   // YYYY-MM-DD or ''
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export function DateRangePicker({
  value,
  onChange,
  label,
  placeholder = 'Select date range',
  className,
  ariaLabel,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { from, to } = value;

  const label1 = from ? formatDisplayDate(from) : null;
  const label2 = to ? formatDisplayDate(to) : null;
  const display = label1 && label2
    ? `${label1} → ${label2}`
    : label1 || label2
      ? (label1 || label2) + ' —'
      : '';

  function clear() {
    onChange({ from: '', to: '' });
  }

  function setFrom(v: string) {
    const next = { ...value, from: v };
    if (v && to && v > to) next.to = '';
    onChange(next);
  }

  function setTo(v: string) {
    const next = { ...value, to: v };
    if (v && from && from > v) next.from = '';
    onChange(next);
  }

  function preset(days: number) {
    if (days === -1) {
      onChange({ from: '', to: '' });
      return;
    }
    const todayStr = getTodayDateValue();
    const t = parseDateValue(todayStr)!;
    const start = new Date(t.year, t.month - 1, t.day - days);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange({ from: fmt(start), to: todayStr });
  }

  const hasRange = Boolean(from || to);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={cn('relative flex items-center', className)}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={ariaLabel || label || placeholder}
            aria-expanded={open}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
            <span className={cn('truncate whitespace-nowrap tabular-nums', display ? 'text-slate-800 font-medium' : 'text-slate-400')}>
              {display || placeholder}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </button>
        </Popover.Trigger>
        {hasRange && (
          <button
            type="button"
            aria-label="Clear date range"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="absolute right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[320px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl outline-none"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label || 'Date Range'}
          </p>

          {/* Presets */}
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => preset(0)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">Today</button>
            <button type="button" onClick={() => preset(7)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">Week</button>
            <button type="button" onClick={() => preset(30)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">Month</button>
            <button type="button" onClick={() => preset(90)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">90 Days</button>
            <button type="button" onClick={() => preset(-1)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">All Time</button>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <label htmlFor="dr-from" className="text-[11px] font-medium text-slate-500">From</label>
              <DatePicker
                id="dr-from"
                value={from}
                onChange={setFrom}
                placeholder="Start date"
                ariaLabel="From date"
                allowClear={false}
              />
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-3.5 w-3.5 rotate-90 text-slate-300" />
            </div>
            <div className="space-y-1">
              <label htmlFor="dr-to" className="text-[11px] font-medium text-slate-500">To</label>
              <DatePicker
                id="dr-to"
                value={to}
                onChange={setTo}
                placeholder="End date"
                ariaLabel="To date"
                allowClear={false}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
            <button type="button" onClick={clear} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
              Done
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
