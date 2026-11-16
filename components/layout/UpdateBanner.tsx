'use client';

import * as React from 'react';
import { CheckCircle2, Download, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UpdateStatus } from '@/types/electron';

type BannerState = UpdateStatus | { state: 'idle' };

/**
 * Slim in-app update banner shown at the top of every authenticated screen.
 * Hidden entirely on the web build and whenever there is nothing to report.
 */
export function UpdateBanner() {
  const [status, setStatus] = React.useState<BannerState>({ state: 'idle' });
  const [dismissed, setDismissed] = React.useState(false);
  const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.isDesktop);

  React.useEffect(() => {
    if (!window.electronAPI?.isDesktop) return;
    // Ask in case the startup check fired before React mounted
    void window.electronAPI.checkForUpdates();
    const unsubscribe = window.electronAPI.onUpdateStatus((next) => {
      setStatus(next);
      setDismissed(false);
    });
    return () => unsubscribe();
  }, []);

  if (!isDesktop || dismissed) return null;

  if (status.state === 'checking') {
    return (
      <div className="no-print flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-500 lg:px-6">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Checking for updates…</span>
      </div>
    );
  }

  if (status.state === 'available') {
    return (
      <div className="no-print flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-1.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-blue-900">
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Update v{status.version} available
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => window.electronAPI?.downloadUpdate()}
          >
            Download
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (status.state === 'downloading') {
    const pct = Math.max(0, Math.min(100, status.percent ?? 0));
    return (
      <div className="no-print flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-1.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-blue-900">
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span className="truncate">Downloading update… {pct}%</span>
        </div>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-blue-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (status.state === 'downloaded') {
    return (
      <div className="no-print flex items-center justify-between gap-3 border-b border-green-100 bg-green-50 px-4 py-1.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-green-900">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Update v{status.version} ready — restart to install
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            className="h-7 bg-green-600 px-2.5 text-[11px] hover:bg-green-700"
            onClick={() => window.electronAPI?.installUpdate()}
          >
            Restart &amp; Install
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-green-500 hover:bg-green-100 hover:text-green-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (status.state === 'error') {
    return (
      <div className="no-print flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-4 py-1.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-amber-900">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={status.message}>
            Update check failed — {status.message || 'please try again'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => window.electronAPI?.checkForUpdates()}
          >
            Try again
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // not-available / anything else: show nothing
  return null;
}
