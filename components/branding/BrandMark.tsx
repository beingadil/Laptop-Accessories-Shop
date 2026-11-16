'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { getBrandInitials } from '@/lib/branding';

interface BrandMarkProps {
  shopName: string;
  logoDataUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandMarkProps['size']>, string> = {
  xs: 'h-7 w-7 rounded-lg text-[11px]',
  sm: 'h-8 w-8 rounded-lg text-xs',
  md: 'h-9 w-9 rounded-lg text-sm',
  lg: 'h-12 w-12 rounded-xl text-base',
  xl: 'h-14 w-14 rounded-xl text-xl',
};

export function BrandMark({
  shopName,
  logoDataUrl,
  size = 'md',
  className,
}: BrandMarkProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (logoDataUrl) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-white p-0.5',
          sizeClass,
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoDataUrl}
          alt={`${shopName} logo`}
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-blue-600 font-bold tracking-tight text-white shadow-xs',
        sizeClass,
        className
      )}
      aria-hidden="true"
    >
      {getBrandInitials(shopName)}
    </div>
  );
}
