import { prisma } from '@/lib/prisma';
import {
  DEFAULT_SHOP_BRANDING,
  normalizeShopBranding,
  type ShopBranding,
} from '@/lib/branding';

export async function getShopBranding(): Promise<ShopBranding> {
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
}
