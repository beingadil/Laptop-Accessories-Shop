'use client';

import * as React from 'react';
import {
  DEFAULT_SHOP_BRANDING,
  normalizeShopBranding,
  type ShopBranding,
} from '@/lib/branding';

const BRANDING_EVENT = 'shop-branding-updated';
const BRANDING_STORAGE_KEY = 'shop-branding-sync-ts';

interface BrandingContextValue {
  branding: ShopBranding;
  setBranding: (next: Partial<ShopBranding> | ShopBranding) => void;
  refreshBranding: () => Promise<ShopBranding | null>;
}

const BrandingContext = React.createContext<BrandingContextValue>({
  branding: DEFAULT_SHOP_BRANDING,
  setBranding: () => {},
  refreshBranding: async () => null,
});

export function BrandingProvider({
  initialBranding,
  children,
}: {
  initialBranding: ShopBranding;
  children: React.ReactNode;
}) {
  const [branding, setBrandingState] = React.useState<ShopBranding>(() =>
    normalizeShopBranding(initialBranding)
  );

  const refreshBranding = React.useCallback(async (): Promise<ShopBranding | null> => {
    try {
      const res = await fetch('/api/branding', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      const normalized = normalizeShopBranding(data);
      setBrandingState(normalized);
      return normalized;
    } catch {
      return null;
    }
  }, []);

  const setBranding = React.useCallback(
    (next: Partial<ShopBranding> | ShopBranding) => {
      const normalized = normalizeShopBranding(next);
      setBrandingState(normalized);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<ShopBranding>(BRANDING_EVENT, { detail: normalized })
        );
        try {
          window.localStorage.setItem(BRANDING_STORAGE_KEY, String(Date.now()));
        } catch {
          // Ignore storage quota / private mode issues
        }
      }
    },
    []
  );

  React.useEffect(() => {
    function handleBrandingEvent(e: Event) {
      const custom = e as CustomEvent<ShopBranding>;
      if (custom.detail) {
        setBrandingState(normalizeShopBranding(custom.detail));
      }
    }

    function handleStorage(e: StorageEvent) {
      if (e.key === BRANDING_STORAGE_KEY) {
        void refreshBranding();
      }
    }

    window.addEventListener(BRANDING_EVENT, handleBrandingEvent);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(BRANDING_EVENT, handleBrandingEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshBranding]);

  const value = React.useMemo(
    () => ({ branding, setBranding, refreshBranding }),
    [branding, setBranding, refreshBranding]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  return React.useContext(BrandingContext);
}
