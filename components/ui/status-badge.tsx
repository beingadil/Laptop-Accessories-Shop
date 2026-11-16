import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const TONE_MAP: Record<StatusTone, string> = {
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  neutral: 'text-slate-600',
  info: 'text-blue-700',
};

export function StatusText({
  tone,
  label,
  className,
}: {
  tone: StatusTone;
  label: string;
  className?: string;
}) {
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'warning'
      ? AlertTriangle
      : tone === 'danger'
      ? XCircle
      : Clock;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        TONE_MAP[tone],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
