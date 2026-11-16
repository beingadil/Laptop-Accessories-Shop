'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MONTH_NAMES,
  WEEKDAY_SHORT_NAMES,
  formatDisplayDate,
  getMonthGrid,
  getTodayDateValue,
  isDateOutOfRange,
  parseDateValue,
  shiftMonth,
} from '@/lib/date-utils';

export interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  allowClear?: boolean;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Select date',
  ariaLabel,
  allowClear = false,
  required = false,
  disabled = false,
  minDate,
  maxDate,
  align = 'start',
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const todayStr = getTodayDateValue();
  const parsedToday = parseDateValue(todayStr)!;
  const parsedSelected = parseDateValue(value);

  const [viewYear, setViewYear] = React.useState<number>(
    parsedSelected?.year ?? parsedToday.year
  );
  const [viewMonth, setViewMonth] = React.useState<number>(
    parsedSelected?.month ?? parsedToday.month
  );

  function handleOpenChange(nextOpen: boolean) {
    if (disabled) return;
    if (nextOpen) {
      const anchor = parseDateValue(value) ?? parseDateValue(getTodayDateValue())!;
      setViewYear(anchor.year);
      setViewMonth(anchor.month);
    }
    setOpen(nextOpen);
  }

  const cells = React.useMemo(
    () => getMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const todayYear = parsedToday.year;
  const yearOptions = React.useMemo(() => {
    const minY = Math.min(todayYear - 10, viewYear - 2);
    const maxY = Math.max(todayYear + 5, viewYear + 2);
    const list: number[] = [];
    for (let y = minY; y <= maxY; y++) {
      list.push(y);
    }
    return list;
  }, [todayYear, viewYear]);

  const displayLabel = formatDisplayDate(value);
  const showClear = allowClear && Boolean(value) && !disabled;

  function selectDate(dateVal: string) {
    if (isDateOutOfRange(dateVal, minDate, maxDate)) return;
    onChange(dateVal);
    setOpen(false);
  }

  function handleStepMonth(delta: number) {
    const next = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <div className={cn('relative flex items-center', className)}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel || placeholder}
            data-required={required || undefined}
            aria-expanded={open}
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
              showClear ? 'pr-8' : 'pr-3',
              displayLabel ? 'text-slate-900 font-medium tabular-nums' : 'text-slate-400'
            )}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate whitespace-nowrap">
              {displayLabel || placeholder}
            </span>
          </button>
        </Popover.Trigger>

        {showClear && (
          <button
            type="button"
            aria-label={`Clear ${ariaLabel || 'date'}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[292px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg outline-none"
        >
          {/* Month / Year Navigation */}
          <div className="mb-2.5 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => handleStepMonth(-1)}
              aria-label="Previous month"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex flex-1 items-center gap-1.5 min-w-0">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                aria-label="Select month"
                className="h-8 flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                aria-label="Select year"
                className="h-8 w-[76px] shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium tabular-nums text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleStepMonth(1)}
              aria-label="Next month"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_SHORT_NAMES.map((dayName) => (
              <div
                key={dayName}
                className="flex h-7 items-center justify-center text-[11px] font-medium text-slate-400"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const isSelected = cell.dateValue === value;
              const isToday = cell.dateValue === todayStr;
              const outOfRange = isDateOutOfRange(cell.dateValue, minDate, maxDate);

              return (
                <button
                  key={cell.dateValue}
                  type="button"
                  disabled={outOfRange}
                  onClick={() => selectDate(cell.dateValue)}
                  aria-label={formatDisplayDate(cell.dateValue)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex h-8 w-full items-center justify-center rounded-lg text-xs tabular-nums transition-colors',
                    outOfRange && 'cursor-not-allowed opacity-35',
                    isSelected
                      ? 'bg-blue-600 font-semibold text-white hover:bg-blue-700'
                      : !cell.inCurrentMonth
                      ? 'text-slate-400 hover:bg-slate-50'
                      : isToday
                      ? 'font-semibold text-blue-700 ring-1 ring-inset ring-blue-500 hover:bg-blue-50'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Actions */}
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              disabled={isDateOutOfRange(todayStr, minDate, maxDate)}
              onClick={() => {
                setViewYear(parsedToday.year);
                setViewMonth(parsedToday.month);
                selectDate(todayStr);
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40"
            >
              Today
            </button>

            <div className="flex items-center gap-1">
              {allowClear && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
