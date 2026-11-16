export interface ShopBranding {
  shopName: string;
  address: string;
  phone1: string;
  phone2: string;
  logoDataUrl: string | null;
  invoicePrefix: string;
  purchasePrefix: string;
  invoiceFooter: string;
  warrantyTerms: string;
  showWarrantyOnInvoice: boolean;
}

export const DEFAULT_SHOP_BRANDING: ShopBranding = {
  shopName: 'Tayyab Enterprises',
  address: 'Muneer Chowk, Shop No. 152',
  phone1: '03126482836',
  phone2: '03298304862',
  logoDataUrl: null,
  invoicePrefix: 'TE-INV-',
  purchasePrefix: 'TE-PUR-',
  invoiceFooter:
    'Thank you for choosing Tayyab Enterprises. Please keep this invoice for warranty claims.',
  warrantyTerms:
    'Standard checking warranty applies as specified per item. Physical damage, burn marks, liquid spill, or tampered seals void warranty.',
  showWarrantyOnInvoice: true,
};

export function normalizeShopBranding(
  input?: Partial<Record<keyof ShopBranding, unknown>> | null
): ShopBranding {
  if (!input) {
    return { ...DEFAULT_SHOP_BRANDING };
  }

  const rawShopName =
    typeof input.shopName === 'string' && input.shopName.trim().length > 0
      ? input.shopName.trim()
      : DEFAULT_SHOP_BRANDING.shopName;

  const rawAddress =
    typeof input.address === 'string' && input.address.trim().length > 0
      ? input.address.trim()
      : DEFAULT_SHOP_BRANDING.address;

  const rawPhone1 =
    typeof input.phone1 === 'string' && input.phone1.trim().length > 0
      ? input.phone1.trim()
      : DEFAULT_SHOP_BRANDING.phone1;

  // Preserve explicitly cleared phone2 (''), only default when missing/undefined
  const rawPhone2 =
    input.phone2 === undefined || input.phone2 === null
      ? input.phone2 === null
        ? ''
        : DEFAULT_SHOP_BRANDING.phone2
      : typeof input.phone2 === 'string'
        ? input.phone2.trim()
        : '';

  const rawLogoDataUrl =
    input.logoDataUrl === undefined
      ? DEFAULT_SHOP_BRANDING.logoDataUrl
      : typeof input.logoDataUrl === 'string' && input.logoDataUrl.trim().length > 0
        ? input.logoDataUrl
        : null;

  const rawInvoicePrefix =
    typeof input.invoicePrefix === 'string' && input.invoicePrefix.trim().length > 0
      ? input.invoicePrefix.trim()
      : DEFAULT_SHOP_BRANDING.invoicePrefix;

  const rawPurchasePrefix =
    typeof input.purchasePrefix === 'string' && input.purchasePrefix.trim().length > 0
      ? input.purchasePrefix.trim()
      : DEFAULT_SHOP_BRANDING.purchasePrefix;

  const rawInvoiceFooter =
    typeof input.invoiceFooter === 'string'
      ? input.invoiceFooter
      : DEFAULT_SHOP_BRANDING.invoiceFooter;

  const rawWarrantyTerms =
    typeof input.warrantyTerms === 'string'
      ? input.warrantyTerms
      : DEFAULT_SHOP_BRANDING.warrantyTerms;

  const showWarrantyOnInvoice =
    typeof input.showWarrantyOnInvoice === 'boolean'
      ? input.showWarrantyOnInvoice
      : DEFAULT_SHOP_BRANDING.showWarrantyOnInvoice;

  return {
    shopName: rawShopName,
    address: rawAddress,
    phone1: rawPhone1,
    phone2: rawPhone2,
    logoDataUrl: rawLogoDataUrl,
    invoicePrefix: rawInvoicePrefix,
    purchasePrefix: rawPurchasePrefix,
    invoiceFooter: rawInvoiceFooter,
    warrantyTerms: rawWarrantyTerms,
    showWarrantyOnInvoice,
  };
}

export function getBrandInitials(shopName: string | null | undefined): string {
  const cleaned = (shopName || '')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (cleaned.length === 0) return 'TE';
  if (cleaned.length === 1) {
    return cleaned[0].slice(0, 2).toUpperCase();
  }
  return `${cleaned[0][0]}${cleaned[1][0]}`.toUpperCase();
}

export function formatShopPhones(
  phone1?: string | null,
  phone2?: string | null,
  separator = ' · '
): string {
  return [phone1?.trim(), phone2?.trim()].filter(Boolean).join(separator);
}

export function slugifyShopName(shopName: string | null | undefined): string {
  const slug = (shopName || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'shop';
}

export function getInvoiceFooterText(
  branding: Pick<ShopBranding, 'shopName' | 'invoiceFooter'>
): string {
  const footer = branding.invoiceFooter?.trim();
  if (footer) return footer;
  return `Thank you for shopping at ${branding.shopName}.`;
}
