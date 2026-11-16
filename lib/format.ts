export function formatPKR(amount: number | null | undefined): string {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatNumber(value: number | null | undefined): string {
  const num = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat('en-PK').format(num);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export const ALLOWED_PAGE_SIZES = [10, 20, 50, 100] as const;

export function parsePaginationParams(searchParams: URLSearchParams) {
  const rawPage = Number(searchParams.get('page') || '1');
  const rawPageSize = Number(searchParams.get('pageSize') || '20');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize = (ALLOWED_PAGE_SIZES as readonly number[]).includes(rawPageSize)
    ? rawPageSize
    : 20;
  const search = (searchParams.get('search') || '').trim();
  const sortBy = (searchParams.get('sortBy') || 'createdAt').trim();
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? ('asc' as const) : ('desc' as const);

  return { page, pageSize, search, sortBy, sortOrder };
}
