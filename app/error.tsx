'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-500">Something went wrong</p>
        <h1 className="text-xl font-semibold text-slate-900">
          This screen hit an unexpected error
        </h1>
        <p className="mx-auto max-w-md text-xs leading-5 text-slate-500">
          {error?.message
            ? 'The error message is: ' + error.message
            : 'The application ran into a problem loading this page.'}
          {pathname !== '/' && (
            <>
              {' '}
              <Link href="/" className="text-blue-600 hover:underline">
                Go to the dashboard
              </Link>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
