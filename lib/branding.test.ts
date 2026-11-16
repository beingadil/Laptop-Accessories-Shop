import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SHOP_BRANDING,
  formatShopPhones,
  getBrandInitials,
  getInvoiceFooterText,
  normalizeShopBranding,
  slugifyShopName,
} from './branding.ts';

test('getBrandInitials extracts clean monogram initials', () => {
  assert.equal(getBrandInitials('Tayyab Enterprises'), 'TE');
  assert.equal(getBrandInitials('Apex Digital Hub'), 'AD');
  assert.equal(getBrandInitials('TechStore'), 'TE');
  assert.equal(getBrandInitials('X'), 'X');
  assert.equal(getBrandInitials('   '), 'TE');
});

test('normalizeShopBranding preserves cleared optional fields and explicit null logo', () => {
  const normalized = normalizeShopBranding({
    shopName: '  Apex Laptops  ',
    address: 'Hall Road, Shop 14',
    phone1: '03001112233',
    phone2: '',
    logoDataUrl: null,
    invoiceFooter: '',
    showWarrantyOnInvoice: false,
  });

  assert.equal(normalized.shopName, 'Apex Laptops');
  assert.equal(normalized.address, 'Hall Road, Shop 14');
  assert.equal(normalized.phone1, '03001112233');
  assert.equal(normalized.phone2, '');
  assert.equal(normalized.logoDataUrl, null);
  assert.equal(normalized.invoiceFooter, '');
  assert.equal(normalized.showWarrantyOnInvoice, false);
});

test('normalizeShopBranding falls back to defaults when input is undefined', () => {
  assert.deepEqual(normalizeShopBranding(undefined), DEFAULT_SHOP_BRANDING);
});

test('formatShopPhones joins non-empty phone numbers cleanly', () => {
  assert.equal(formatShopPhones('03001112233', '03214445566'), '03001112233 · 03214445566');
  assert.equal(formatShopPhones('03001112233', ''), '03001112233');
  assert.equal(formatShopPhones('', ''), '');
});

test('slugifyShopName generates clean filename prefixes', () => {
  assert.equal(slugifyShopName('Tayyab Enterprises'), 'tayyab-enterprises');
  assert.equal(slugifyShopName('Apex & Co. Laptops!'), 'apex-co-laptops');
  assert.equal(slugifyShopName(''), 'shop');
});

test('getInvoiceFooterText falls back dynamically to shopName when footer is empty', () => {
  assert.equal(
    getInvoiceFooterText({ shopName: 'Apex Laptops', invoiceFooter: '' }),
    'Thank you for shopping at Apex Laptops.'
  );
  assert.equal(
    getInvoiceFooterText({ shopName: 'Apex Laptops', invoiceFooter: 'Custom Footer Note' }),
    'Custom Footer Note'
  );
});
