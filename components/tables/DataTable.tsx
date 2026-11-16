'use client';

import * as React from 'react';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ALLOWED_PAGE_SIZES, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
  searchPlaceholder?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange?: (sortBy: string) => void;
  filters?: React.ReactNode;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  total,
  page,
  pageSize,
  totalPages,
  search,
  searchPlaceholder = 'Search records...',
  sortBy,
  onSearchChange,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  filters,
  onExportExcel,
  onExportPdf,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or filter criteria.',
  emptyAction,
}: DataTableProps<T>) {
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(total, page * pageSize);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-white">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="pl-9"
            />
          </div>
          {filters}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onExportExcel && (
            <Button type="button" variant="outline" size="sm" onClick={onExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Excel
            </Button>
          )}
          {onExportPdf && (
            <Button type="button" variant="outline" size="sm" onClick={onExportPdf}>
              <Download className="h-3.5 w-3.5 text-blue-600" />
              PDF
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-slate-50">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.className
                )}
              >
                {col.sortable && onSortChange ? (
                  <button
                    type="button"
                    onClick={() => onSortChange(col.key)}
                    className={cn(
                      'inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900',
                      sortBy === col.key && 'text-blue-600'
                    )}
                  >
                    {col.header}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: Math.min(pageSize, 6) }).map((_, idx) => (
              <TableRow key={`skeleton-${idx}`}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <div className="h-4 w-full max-w-[140px] animate-pulse rounded bg-slate-100" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow className="hover:bg-white">
              <TableCell colSpan={columns.length} className="py-12 text-center">
                <div className="mx-auto max-w-md space-y-2">
                  <p className="text-sm font-semibold text-slate-900">{emptyTitle}</p>
                  <p className="text-xs text-slate-500">{emptyDescription}</p>
                  {emptyAction && <div className="pt-2">{emptyAction}</div>}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      col.align === 'right' && 'text-right tabular-nums',
                      col.align === 'center' && 'text-center',
                      col.className
                    )}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 bg-slate-50/60 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span className="tabular-nums">
            Showing <strong className="text-slate-900">{formatNumber(startRecord)}</strong>–
            <strong className="text-slate-900">{formatNumber(endRecord)}</strong> of{' '}
            <strong className="text-slate-900">{formatNumber(total)}</strong> records
          </span>
          <div className="flex items-center gap-1.5">
            <label htmlFor="page-size-select" className="text-slate-500">
              Rows:
            </label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {ALLOWED_PAGE_SIZES.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <span className="px-2.5 tabular-nums font-medium text-slate-700">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
