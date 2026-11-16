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
