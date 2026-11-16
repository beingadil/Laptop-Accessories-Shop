'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BrandMark } from '@/components/branding/BrandMark';
import { useBranding } from '@/components/branding/BrandingProvider';
import { Button } from '@/components/ui/button';
import {
  formatShopPhones,
  getInvoiceFooterText,
  normalizeShopBranding,
} from '@/lib/branding';
import { formatDate, formatPKR } from '@/lib/format';
import { downloadInvoicePDF } from '@/lib/export-invoice-pdf';

interface InvoiceResponse {
  sale: {
    id: string;
    invoiceNumber: string;
    saleDate: string;
    subtotal: number;
    discount: number;
    totalAmount: number;
    paymentMethod: string;
    status: string;
    notes: string | null;
    walkInCustomerName: string | null;
    walkInCustomerPhone: string | null;
    customer: { name: string; phone: string; address: string | null } | null;
    items: Array<{
      id: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      totalAmount: number;
      warrantyMonths: number;
      product: {
        name: string;
        sku: string;
        processor: string | null;
        ram: string | null;
        ssd: string | null;
      };
      serializedItem: { serialNumber: string } | null;
    }>;
  };
  settings: {
    shopName: string;
    address: string;
    phone1: string;
    phone2: string | null;
    logoDataUrl: string | null;
    invoiceFooter: string;
    warrantyTerms: string;
    showWarrantyOnInvoice: boolean;
  };
}

export default function A4InvoicePage() {
  const params = useParams<{ id: string }>();
  const { branding: liveBranding } = useBranding();
  const [data, setData] = React.useState<InvoiceResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/sales/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [params.id]);

  const sale = data?.sale;
  const invoiceBranding = normalizeShopBranding(data?.settings ?? liveBranding);
  const phonesLine = formatShopPhones(invoiceBranding.phone1, invoiceBranding.phone2);

  function handlePrint() {
    if (window.electronAPI?.printWindow) {
      void window.electronAPI.printWindow();
      return;
    }
    window.print();
  }

  async function handleDownloadPdf() {
    if (!data?.sale) return;
    const { sale: currentSale } = data;
    await downloadInvoicePDF({
      shopName: invoiceBranding.shopName,
      address: invoiceBranding.address,
      phone1: invoiceBranding.phone1,
      phone2: invoiceBranding.phone2,
      logoDataUrl: invoiceBranding.logoDataUrl,
      invoiceFooter: getInvoiceFooterText(invoiceBranding),
      warrantyTerms: invoiceBranding.warrantyTerms,
      showWarrantyOnInvoice: invoiceBranding.showWarrantyOnInvoice,
      invoiceNumber: currentSale.invoiceNumber,
      saleDate: currentSale.saleDate,
      customerName:
        currentSale.customer?.name || currentSale.walkInCustomerName || 'Walk-in Customer',
      customerPhone: currentSale.customer?.phone || currentSale.walkInCustomerPhone,
      customerAddress: currentSale.customer?.address,
      paymentMethod: currentSale.paymentMethod,
      subtotal: currentSale.subtotal,
      discount: currentSale.discount,
      totalAmount: currentSale.totalAmount,
      notes: currentSale.notes,
      items: currentSale.items.map((item) => ({
        name: item.product.name,
        sku: item.product.sku,
        serialNumber: item.serializedItem?.serialNumber,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        totalAmount: item.totalAmount,
        warrantyMonths: item.warrantyMonths,
      })),
    });
  }

  return (
    <AppShell pageTitle="A4 Sales Invoice">
      <div className="space-y-4">
        {/* Action Toolbar (Hidden when printing) */}
        <div className="mx-auto max-w-[210mm] flex flex-wrap items-center justify-between gap-3 no-print">
          <Link
            href={sale ? `/sales/${sale.id}` : '/sales'}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sale Details
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={!sale}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button onClick={handlePrint} disabled={!sale}>
              <Printer className="h-4 w-4" />
              Print A4 Invoice
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="mx-auto max-w-[210mm] h-[297mm] rounded-xl border border-slate-200 bg-white animate-pulse" />
        ) : !sale ? (
          <div className="mx-auto max-w-[210mm] rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Invoice not found.
          </div>
        ) : (
          /* A4 Sheet Container */
          <div className="print-only-area mx-auto w-full max-w-[210mm] min-h-[270mm] rounded-xl border border-slate-200 bg-white p-8 sm:p-10 text-slate-900 flex flex-col justify-between">
            <div className="space-y-7">
              {/* Top Shop Header */}
              <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
                <div className="flex items-center gap-4">
                  <BrandMark
                    shopName={invoiceBranding.shopName}
                    logoDataUrl={invoiceBranding.logoDataUrl}
                    size="xl"
                  />
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                      {invoiceBranding.shopName}
                    </h1>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {invoiceBranding.address}
                    </p>
                    {phonesLine && (
                      <p className="text-xs font-mono text-slate-600 mt-0.5">
                        Tel: {phonesLine}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Sales Invoice
                  </div>
                  <div className="text-lg font-bold font-mono text-slate-900">
                    {sale.invoiceNumber}
                  </div>
                  <div className="text-xs text-slate-600">Date: {formatDate(sale.saleDate)}</div>
                  <div className="text-xs font-medium text-emerald-700">
                    Payment: {sale.paymentMethod} · PAID
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Bill To
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {sale.customer?.name || sale.walkInCustomerName || 'Walk-in Customer'}
                  </div>
                  {(sale.customer?.phone || sale.walkInCustomerPhone) && (
                    <div className="text-xs font-mono text-slate-600 mt-0.5">
                      Phone: {sale.customer?.phone || sale.walkInCustomerPhone}
                    </div>
                  )}
                  {sale.customer?.address && (
                    <div className="text-xs text-slate-600 mt-0.5">{sale.customer.address}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Invoice Currency
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-700">Pakistani Rupees (PKR)</div>
                  <div className="text-xs text-slate-500 mt-0.5">Status: {sale.status}</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold w-10">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Product & Serial / Specs</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold w-14">Qty</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold w-28">Unit Price</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold w-24">Disc.</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold w-24">Warranty</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sale.items.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 text-xs font-mono text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{item.product.name}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {item.serializedItem
                              ? `Serial #: ${item.serializedItem.serialNumber}`
                              : `SKU: ${item.product.sku}`}
                          </div>
                          {(item.product.processor || item.product.ram || item.product.ssd) && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {[item.product.processor, item.product.ram, item.product.ssd]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono">{item.quantity}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatPKR(item.unitPrice)}</td>
                        <td className="px-3 py-3 text-right font-mono text-slate-500">
                          {item.discount > 0 ? formatPKR(item.discount) : '—'}
                        </td>
                        <td className="px-3 py-3 text-center text-xs">
                          {item.warrantyMonths > 0 ? `${item.warrantyMonths} Mo` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900">
                          {formatPKR(item.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatPKR(sale.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Invoice Discount</span>
                    <span className="font-mono">- {formatPKR(sale.discount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-slate-900">
                    <span>Grand Total</span>
                    <span className="font-mono">{formatPKR(sale.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {sale.notes && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <strong>Notes:</strong> {sale.notes}
                </div>
              )}

              {invoiceBranding.showWarrantyOnInvoice && invoiceBranding.warrantyTerms && (
                <div className="rounded-lg border border-slate-200 p-3.5 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800">Warranty Terms & Conditions</div>
                  <p className="leading-relaxed">{invoiceBranding.warrantyTerms}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-10 border-t border-slate-200 pt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{getInvoiceFooterText(invoiceBranding)}</span>
              <span className="font-medium text-slate-700">Authorized Signature</span>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
