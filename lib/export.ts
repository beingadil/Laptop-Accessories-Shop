import {
  DEFAULT_SHOP_BRANDING,
  formatShopPhones,
  type ShopBranding,
} from '@/lib/branding';

export interface ExportColumn<T> {
  header: string;
  key: keyof T | ((row: T) => string | number);
  width?: number;
}

type ExportBranding = Pick<ShopBranding, 'shopName' | 'address' | 'phone1' | 'phone2'>;

export async function exportToExcel<T>(params: {
  filename: string;
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  branding?: ExportBranding;
}): Promise<void> {
  const shop = params.branding || DEFAULT_SHOP_BRANDING;
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${shop.shopName} Management System`;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(params.sheetName.slice(0, 31));

  // Title Row
  sheet.addRow([`${shop.shopName} — ${params.title}`]);
  sheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

  if (params.subtitle) {
    sheet.addRow([params.subtitle]);
    sheet.getRow(2).font = { size: 10, color: { argb: 'FF475569' } };
  }
  sheet.addRow([]);

  const headerRowIndex = sheet.rowCount + 1;
  const headerValues = params.columns.map((c) => c.header);
  const headerRow = sheet.addRow(headerValues);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  for (const row of params.rows) {
    const values = params.columns.map((col) => {
      if (typeof col.key === 'function') {
        return col.key(row);
      }
      const val = row[col.key];
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toLocaleDateString('en-GB');
      return String(val);
    });
    sheet.addRow(values);
  }

  params.columns.forEach((col, idx) => {
    const column = sheet.getColumn(idx + 1);
    column.width = col.width || Math.max(16, col.header.length + 6);
  });

  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${params.filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportToPDF<T>(params: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  orientation?: 'portrait' | 'landscape';
  branding?: ExportBranding;
}): Promise<void> {
  const shop = params.branding || DEFAULT_SHOP_BRANDING;
  const phonesLine = formatShopPhones(shop.phone1, shop.phone2);
  const metaLine = [shop.address, phonesLine].filter(Boolean).join(' · ');

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({
    orientation: params.orientation || (params.columns.length > 6 ? 'landscape' : 'portrait'),
    unit: 'mm',
    format: 'a4',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(shop.shopName, 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(metaLine, 14, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235);
  doc.text(params.title, 14, 30);

  if (params.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(params.subtitle, 14, 35);
  }

  const head = [params.columns.map((c) => c.header)];
  const body = params.rows.map((row) =>
    params.columns.map((col) => {
      if (typeof col.key === 'function') {
        return String(col.key(row) ?? '');
      }
      const val = row[col.key];
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toLocaleDateString('en-GB');
      return String(val);
    })
  );

  autoTable(doc, {
    head,
    body,
    startY: params.subtitle ? 40 : 35,
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${params.filename}.pdf`);
}

const TYPE_PDF_LABEL: Record<string, string> = {
  OPENING_BALANCE: 'Opening Balance',
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  PAYMENT: 'Payment',
  SALE_RETURN: 'Sale Return',
  ADVANCE_PAYMENT: 'Advance',
  CREDIT_NOTE: 'Credit Note',
  DEBIT_ADJUSTMENT: 'Debit Adj.',
  REFUND: 'Refund',
  WRITE_OFF: 'Write Off',
};

/** Row shape consumed by the ledger PDF statement (kept decoupled from Prisma/domain types). */
export interface LedgerPdfEntry {
  date: string;
  accountName: string;
  referenceNumber: string;
  description: string;
  entryType: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export async function exportLedgerPdf(params: {
  filename: string;
  scopeLabel: string;
  periodLabel: string;
  entries: LedgerPdfEntry[];
  /** Formatted date label for the opening row (e.g. "1 Jan 2026"). Falsy = no opening row. */
  openingDateLabel?: string;
  openingBalance: number;
  totalsDebit: number;
  totalsCredit: number;
  closingBalance: number;
  branding?: ExportBranding;
}): Promise<void> {
  const { formatPKR } = await import('@/lib/format');
  const shop = params.branding || DEFAULT_SHOP_BRANDING;
  const phonesLine = formatShopPhones(shop.phone1, shop.phone2);
  const metaLine = [shop.address, phonesLine].filter(Boolean).join('  ·  ');

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // ---- Header block ------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(shop.shopName, margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  if (metaLine) doc.text(metaLine, margin, 19.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235);
  doc.text('General Ledger', margin, 27);

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.6);
  doc.line(margin, 30, pageW - margin, 30);

  const generated = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Account:  ${params.scopeLabel}`, margin, 35.5);
  doc.text(`Period:  ${params.periodLabel}`, margin, 40.5);
  doc.text(`Generated:  ${generated}`, pageW - margin, 35.5, { align: 'right' });
  doc.text(`${params.entries.length} entries`, pageW - margin, 40.5, { align: 'right' });

  // ---- Table body ---------------------------------------------------------
  const body: (string | { content: string; styles?: Record<string, unknown> })[][] = [];

  const showOpening = Boolean(params.openingDateLabel) && params.openingBalance !== 0;
  if (showOpening) {
    const opening = Math.abs(params.openingBalance);
    body.push([
      '',
      params.openingDateLabel as string,
      params.scopeLabel,
      'OPENING',
      'Balance brought forward',
      params.openingBalance > 0 ? formatPKR(opening) : '—',
      params.openingBalance < 0 ? formatPKR(opening) : '—',
      { content: formatPKR(params.openingBalance), styles: { fontStyle: 'bold' } },
    ]);
  }

  for (const [i, e] of params.entries.entries()) {
    body.push([
      String(i + 1),
      e.date,
      e.accountName,
      e.referenceNumber,
      `${TYPE_PDF_LABEL[e.entryType] ?? e.entryType} — ${e.description}`,
      e.debit > 0 ? formatPKR(e.debit) : '—',
      e.credit > 0 ? formatPKR(e.credit) : '—',
      { content: formatPKR(e.runningBalance), styles: { fontStyle: 'bold' } },
    ]);
  }

  autoTable(doc, {
    head: [['Sr', 'Date', 'Account', 'Reference', 'Narration', 'Debit (+)', 'Credit (−)', 'Balance']],
    body,
    startY: 45,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 44 },
      3: { cellWidth: 34 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 30, halign: 'right' },
      6: { cellWidth: 30, halign: 'right' },
      7: { cellWidth: 31, halign: 'right' },
    },
    foot: [
      [
        { content: 'Total Period Activity', colSpan: 5, styles: { halign: 'left', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: formatPKR(params.totalsDebit), styles: { halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138], fillColor: [241, 245, 249] } },
        { content: formatPKR(params.totalsCredit), styles: { halign: 'right', fontStyle: 'bold', textColor: [6, 95, 70], fillColor: [241, 245, 249] } },
        { content: '—', styles: { halign: 'right', fillColor: [241, 245, 249] } },
      ],
      [
        {
          content: 'Closing Balance  (Net Dr − Cr)',
          colSpan: 5,
          styles: { halign: 'left', fontStyle: 'bold', fontSize: 9, fillColor: [254, 243, 199], textColor: [120, 53, 15] },
        },
        { content: '', colSpan: 2, styles: { fillColor: [254, 243, 199] } },
        {
          content: `${formatPKR(Math.abs(params.closingBalance))} ${params.closingBalance >= 0 ? 'Dr' : 'Cr'}`,
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, fillColor: [254, 243, 199], textColor: [120, 53, 15] },
        },
      ],
    ],
    footStyles: { fontSize: 8, cellPadding: 2.2, lineColor: [203, 213, 225], lineWidth: 0.15 },
    didParseCell: (cellData) => {
      // Opening Balance row (first body row when present) in amber
      if (showOpening && cellData.section === 'body' && cellData.row.index === 0) {
        cellData.cell.styles.fillColor = [255, 251, 235];
        cellData.cell.styles.textColor = [146, 64, 14];
        cellData.cell.styles.fontStyle = 'bolditalic';
      }
    },
  });

  // ---- Signature block on the last page ----------------------------------
  const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  let signY = (lastAutoTable?.finalY ?? 50) + 16;
  if (signY > pageH - 22) {
    doc.addPage();
    signY = 30;
  }
  const colW = (pageW - margin * 2) / 3;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  for (let i = 0; i < 3; i++) {
    const x0 = margin + i * colW + 6;
    doc.line(x0, signY, x0 + colW - 24, signY);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Prepared by', margin + 6, signY + 4.5);
  doc.text('Signature / Stamp', margin + colW + 6, signY + 4.5);
  doc.text('Date', margin + 2 * colW + 6, signY + 4.5);

  // ---- Footer on every page ----------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 9, pageW - margin, pageH - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${shop.shopName} — General Ledger — ${params.scopeLabel}`, margin, pageH - 5);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 5, { align: 'right' });
  }

  doc.save(`${params.filename}.pdf`);
}
