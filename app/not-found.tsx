import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-500">404</p>
        <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-500">This page does not exist or was removed.</p>
      </div>
      <Button asChild>
        <Link href="/">Go to dashboard</Link>
      </Button>
    </div>
  );
}
