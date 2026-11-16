export const MONTH_NAMES = [
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
] as const;

export const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const WEEKDAY_SHORT_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

export interface ParsedDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export interface CalendarCell {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dateValue: string; // YYYY-MM-DD
  inCurrentMonth: boolean;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function formatDateValue(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateValue(value: string | null | undefined): ParsedDate | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  const maxDay = getDaysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;
  return { year, month, day };
}

export function getTodayDateValue(now: Date = new Date()): string {
  return formatDateValue(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function formatDisplayDate(value: string | null | undefined): string {
  const parsed = parseDateValue(value);
  if (!parsed) return '';
  const dayStr = String(parsed.day).padStart(2, '0');
  const monthStr = MONTH_SHORT_NAMES[parsed.month - 1];
  return `${dayStr} ${monthStr} ${parsed.year}`;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const zeroIndexed = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(zeroIndexed / 12);
  const nextMonth = ((zeroIndexed % 12) + 12) % 12 + 1;
  return { year: nextYear, month: nextMonth };
}

export function getMonthGrid(year: number, month: number): CalendarCell[] {
  const firstDayWeekday = new Date(year, month - 1, 1).getDay(); // 0=Su .. 6=Sa
  const daysInMonth = getDaysInMonth(year, month);
  const prev = shiftMonth(year, month, -1);
  const daysInPrevMonth = getDaysInMonth(prev.year, prev.month);
  const next = shiftMonth(year, month, 1);

  const cells: CalendarCell[] = [];

  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({
      year: prev.year,
      month: prev.month,
      day,
      dateValue: formatDateValue(prev.year, prev.month, day),
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      year,
      month,
      day,
      dateValue: formatDateValue(year, month, day),
      inCurrentMonth: true,
    });
  }

  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    cells.push({
      year: next.year,
      month: next.month,
      day,
      dateValue: formatDateValue(next.year, next.month, day),
      inCurrentMonth: false,
    });
  }

  return cells;
}

export function isDateOutOfRange(
  dateValue: string,
  minDate?: string,
  maxDate?: string
): boolean {
  if (minDate && parseDateValue(minDate) && dateValue < minDate) {
    return true;
  }
  if (maxDate && parseDateValue(maxDate) && dateValue > maxDate) {
    return true;
  }
  return false;
}
