'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FormPageShellProps {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  submitLabel?: string;
  saving?: boolean;
  onCancel?: () => void;
  formId?: string;
  children: React.ReactNode;
}

export function FormPageShell({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  submitLabel = 'Save Record',
  saving = false,
  onCancel,
  formId = 'entity-form',
  children,
}: FormPageShellProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          ) : (
            <Button type="button" variant="outline" asChild disabled={saving}>
              <Link href={backHref}>Cancel</Link>
            </Button>
          )}
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>

      {children}
    </div>
  );
}
