import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_SHOP_BRANDING,
  normalizeShopBranding,
  type ShopBranding,
} from '@/lib/branding';

// Deduped per server request — the root layout calls this twice (generateMetadata + layout).
export const getShopBranding = cache(async function getShopBranding(): Promise<ShopBranding> {
  try {
    const settings = await prisma.shopSettings.findUnique({
      where: { id: 'default' },
      select: {
        shopName: true,
        address: true,
        phone1: true,
        phone2: true,
        logoDataUrl: true,
        invoicePrefix: true,
        purchasePrefix: true,
        invoiceFooter: true,
        warrantyTerms: true,
        showWarrantyOnInvoice: true,
      },
    });
    return normalizeShopBranding(settings);
  } catch {
    return { ...DEFAULT_SHOP_BRANDING };
  }
});
