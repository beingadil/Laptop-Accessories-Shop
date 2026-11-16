import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateValue,
  formatDisplayDate,
  getDaysInMonth,
  getMonthGrid,
  isDateOutOfRange,
  parseDateValue,
  shiftMonth,
} from './date-utils';

test('parseDateValue validates leap years and calendar bounds', () => {
  assert.deepEqual(parseDateValue('2024-02-29'), { year: 2024, month: 2, day: 29 });
  assert.equal(parseDateValue('2025-02-29'), null);
  assert.equal(parseDateValue('2026-13-01'), null);
  assert.equal(parseDateValue('2026-04-31'), null);
  assert.equal(parseDateValue('invalid'), null);
  assert.equal(parseDateValue(''), null);
});

test('formatDateValue and formatDisplayDate round-trip without timezone shift', () => {
  const val = formatDateValue(2026, 11, 5);
  assert.equal(val, '2026-11-05');
  assert.equal(formatDisplayDate(val), '05 Nov 2026');
  assert.equal(formatDisplayDate('bad-date'), '');
});

test('shiftMonth crosses year boundaries accurately', () => {
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 6, 3), { year: 2026, month: 9 });
});

test('getMonthGrid always returns 42 cells with exact leading and trailing days', () => {
  const grid = getMonthGrid(2026, 11); // Nov 1, 2026 is Sunday
  assert.equal(grid.length, 42);
  assert.equal(grid[0].dateValue, '2026-11-01');
  assert.equal(grid[0].inCurrentMonth, true);
  assert.equal(grid[29].dateValue, '2026-11-30');
  assert.equal(grid[29].inCurrentMonth, true);
  assert.equal(grid[30].dateValue, '2026-12-01');
  assert.equal(grid[30].inCurrentMonth, false);

  assert.equal(getDaysInMonth(2024, 2), 29);
  assert.equal(getDaysInMonth(2026, 2), 28);
});

test('isDateOutOfRange respects minDate and maxDate', () => {
  assert.equal(isDateOutOfRange('2026-11-10', '2026-11-12', '2026-11-20'), true);
  assert.equal(isDateOutOfRange('2026-11-15', '2026-11-12', '2026-11-20'), false);
  assert.equal(isDateOutOfRange('2026-11-25', '2026-11-12', '2026-11-20'), true);
});
