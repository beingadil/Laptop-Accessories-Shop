import { formatDate, formatPKR } from '@/lib/format';

export interface InvoicePdfData {
  shopName: string;
  address: string;
  phone1: string;
  phone2?: string | null;
  logoDataUrl?: string | null;
  invoiceFooter: string;
  warrantyTerms: string;
  showWarrantyOnInvoice: boolean;
  invoiceNumber: string;
  saleDate: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  notes?: string | null;
  items: Array<{
    name: string;
    sku: string;
    serialNumber?: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    totalAmount: number;
    warrantyMonths: number;
  }>;
}

export async function downloadInvoicePDF(data: InvoicePdfData): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let headerLeft = 14;
  if (data.logoDataUrl && data.logoDataUrl.startsWith('data:image/')) {
    try {
      const format = data.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(data.logoDataUrl, format, 14, 12, 18, 18);
      headerLeft = 36;
    } catch {
      headerLeft = 14;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(data.shopName, headerLeft, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(data.address, headerLeft, 24);
  const phones = [data.phone1, data.phone2].filter(Boolean).join(' · ');
  doc.text(`Tel: ${phones}`, headerLeft, 29);

  // Invoice badge block on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235);
  doc.text('SALES INVOICE', pageWidth - 14, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Invoice #: ${data.invoiceNumber}`, pageWidth - 14, 24, { align: 'right' });
  doc.text(`Date: ${formatDate(data.saleDate)}`, pageWidth - 14, 29, { align: 'right' });
  doc.text(`Payment: ${data.paymentMethod} (Paid)`, pageWidth - 14, 34, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 38, pageWidth - 14, 38);

  // Customer info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text('BILL TO', 14, 45);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(data.customerName || 'Walk-in Customer', 14, 51);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  if (data.customerPhone) doc.text(`Phone: ${data.customerPhone}`, 14, 56);
  if (data.customerAddress) doc.text(`Address: ${data.customerAddress}`, 14, 61);

  const tableRows = data.items.map((item, idx) => [
    String(idx + 1),
    item.serialNumber ? `${item.name}\nSN: ${item.serialNumber}` : `${item.name}\nSKU: ${item.sku}`,
    String(item.quantity),
    formatPKR(item.unitPrice),
    item.discount > 0 ? formatPKR(item.discount) : '—',
    item.warrantyMonths > 0 ? `${item.warrantyMonths} Mo` : 'None',
    formatPKR(item.totalAmount),
  ]);

  autoTable(doc, {
    head: [['#', 'Product & Serial / SKU', 'Qty', 'Unit Price', 'Discount', 'Warranty', 'Total']],
    body: tableRows,
    startY: 68,
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: 'right', cellWidth: 14 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 30 },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Totals box on right
  const summaryX = pageWidth - 78;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', summaryX, finalY);
  doc.text(formatPKR(data.subtotal), pageWidth - 14, finalY, { align: 'right' });

  doc.text('Invoice Discount:', summaryX, finalY + 6);
  doc.text(`- ${formatPKR(data.discount)}`, pageWidth - 14, finalY + 6, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX, finalY + 9, pageWidth - 14, finalY + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total:', summaryX, finalY + 15);
  doc.text(formatPKR(data.totalAmount), pageWidth - 14, finalY + 15, { align: 'right' });

  let notesY = finalY + 26;
  if (data.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notes:', 14, notesY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.notes, 14, notesY + 5, { maxWidth: pageWidth - 28 });
    notesY += 14;
  }

  if (data.showWarrantyOnInvoice && data.warrantyTerms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Warranty Terms & Conditions:', 14, notesY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(data.warrantyTerms, 14, notesY + 4.5, { maxWidth: pageWidth - 28 });
  }

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 276, pageWidth - 14, 276);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(data.invoiceFooter || 'Thank you for your business!', pageWidth / 2, 282, {
    align: 'center',
    maxWidth: pageWidth - 28,
  });

  doc.save(`${data.invoiceNumber}.pdf`);
}
