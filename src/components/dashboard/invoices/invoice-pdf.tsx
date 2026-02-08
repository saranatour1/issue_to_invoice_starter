import { DateTime } from 'luxon';

import type { InvoiceLineItem } from './invoice-ui';

import { formatCurrencyFromCents, formatHours } from '@/lib/dashboardFormat';

function pdfEscape(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

function buildSimplePdf(args: { contentStream: string; pageWidth: number; pageHeight: number }) {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(args.contentStream);

  const objects: Record<number, string> = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${args.pageWidth} ${args.pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    4: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    5: `<< /Length ${contentBytes.length} >>\nstream\n${args.contentStream}\nendstream`,
  };

  const chunks: Array<Uint8Array> = [];
  const offsets: Array<number> = [];
  let offset = 0;

  const push = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    offset += bytes.length;
  };

  push('%PDF-1.4\n');

  for (let i = 1; i <= 5; i++) {
    offsets[i] = offset;
    push(`${i} 0 obj\n${objects[i]}\nendobj\n`);
  }

  const xrefStart = offset;
  push('xref\n');
  push('0 6\n');
  push('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    const off = String(offsets[i] ?? 0).padStart(10, '0');
    push(`${off} 00000 n \n`);
  }
  push('trailer\n');
  push('<< /Size 6 /Root 1 0 R >>\n');
  push('startxref\n');
  push(`${xrefStart}\n`);
  push('%%EOF\n');

  const totalLen = chunks.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(totalLen);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

function textLine(text: string, x: number, y: number, fontSize: number) {
  return `BT /F1 ${fontSize} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(text)}) Tj ET\n`;
}

function drawRectFill(x: number, y: number, w: number, h: number) {
  return `${x} ${y} ${w} ${h} re f\n`;
}

function drawRectStroke(x: number, y: number, w: number, h: number) {
  return `${x} ${y} ${w} ${h} re S\n`;
}

function drawLine(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S\n`;
}

function truncate(text: string, maxLen: number) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

function parsePayment(paymentInstructions: string | null | undefined) {
  const result: { bank: string; accountName: string; routingNumber: string; accountNumber: string; extra: Array<string> } =
    {
      bank: '',
      accountName: '',
      routingNumber: '',
      accountNumber: '',
      extra: [],
    };

  const text = paymentInstructions?.trim();
  if (!text) return result;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const unkeyedLines: Array<string> = [];
  for (const line of lines) {
    const match = /^([^:]+):\s*(.+)$/.exec(line);
    if (!match) {
      unkeyedLines.push(line);
      continue;
    }

    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (!value) continue;

    if (key === 'bank') {
      result.bank = value;
    } else if (key === 'account name' || key === 'account') {
      result.accountName = value;
    } else if (key === 'routing number' || key === 'routing') {
      result.routingNumber = value;
    } else if (key === 'account number') {
      result.accountNumber = value;
    } else {
      result.extra.push(line);
    }
  }

  // If the user provides unkeyed lines, treat them as positional fields:
  // 1) Bank, 2) Account Name, 3) Routing Number, 4) Account Number.
  // Any remaining lines are treated as extra notes.
  const fillOrder: Array<'bank' | 'accountName' | 'routingNumber' | 'accountNumber'> = [
    'bank',
    'accountName',
    'routingNumber',
    'accountNumber',
  ];
  let nextIndex = 0;
  for (const line of unkeyedLines) {
    while (nextIndex < fillOrder.length && result[fillOrder[nextIndex]] !== '') {
      nextIndex += 1;
    }
    if (nextIndex < fillOrder.length) {
      result[fillOrder[nextIndex]] = line;
      nextIndex += 1;
    } else {
      result.extra.push(line);
    }
  }

  return result;
}

export function exportInvoicePdf(args: {
  invoiceNumber: string;
  projectName: string;
  clientName?: string | null;
  clientLocation?: string | null;
  fromLocation?: string | null;
  paymentInstructions?: string | null;
  periodStart: number;
  periodEnd: number;
  hourlyRateCents: number;
  currency: string;
  lineItems: Array<InvoiceLineItem>;
  timezone?: string | null;
}) {
  const zone = args.timezone || undefined;
  const periodStart = DateTime.fromMillis(args.periodStart, { zone }).toFormat('MMM d, yyyy');
  const periodEndInclusive = DateTime.fromMillis(args.periodEnd, { zone }).minus({ days: 1 }).toFormat('MMM d, yyyy');
  const periodLabel = `${periodStart} – ${periodEndInclusive}`;

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 24;
  const innerWidth = pageWidth - margin * 2;
  const innerHeight = pageHeight - margin * 2;
  const left = margin + 22;
  const right = pageWidth - margin - 22;

  const content: Array<string> = [];

  // Border + header background (based on provided template.pdf)
  content.push('0.72 0.70 0.68 RG 1 w\n');
  content.push(drawRectStroke(margin, margin, innerWidth, innerHeight));

  // Header band
  const headerTop = pageHeight - margin;
  const headerHeight = 82;
  content.push('0.95 0.94 0.93 rg\n');
  content.push(drawRectFill(margin, headerTop - headerHeight, innerWidth, headerHeight));

  // Subtle right stripes in header
  content.push('0.90 0.89 0.88 rg\n');
  content.push(drawRectFill(pageWidth - margin - 120, headerTop - headerHeight, 20, headerHeight));
  content.push(drawRectFill(pageWidth - margin - 88, headerTop - headerHeight, 12, headerHeight));
  content.push(drawRectFill(pageWidth - margin - 62, headerTop - headerHeight, 8, headerHeight));

  // Header text
  content.push('0 0 0 rg\n');
  content.push(textLine('INVOICE', left, headerTop - 40, 26));
  content.push(textLine('#', left, headerTop - 64, 10));
  content.push(textLine(args.invoiceNumber, left + 12, headerTop - 64, 10));
  content.push(textLine('TERM:', left + 80, headerTop - 64, 10));
  content.push(textLine(truncate(periodLabel, 34), left + 118, headerTop - 64, 10));

  // Billed to
  const billedTop = headerTop - headerHeight - 34;
  content.push(textLine('BILLED TO:', left, billedTop, 11));
  content.push('0.25 0.25 0.25 rg\n');
  content.push(textLine('Name:', left, billedTop - 18, 9));
  content.push(textLine('Address:', left, billedTop - 32, 9));
  content.push(textLine('Email:', left, billedTop - 60, 9));

  content.push('0 0 0 rg\n');
  const clientName = args.clientName?.trim() ? args.clientName.trim() : args.projectName;
  const clientLocationLines = (args.clientLocation ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
  const clientAddressLines = clientLocationLines.slice(0, 2);
  const clientEmailLine = clientLocationLines.slice(2).join(' ');
  content.push(textLine(truncate(clientName, 42), left + 54, billedTop - 18, 9));
  content.push(textLine(truncate(clientAddressLines[0] ?? '', 42), left + 54, billedTop - 32, 9));
  content.push(textLine(truncate(clientAddressLines[1] ?? '', 42), left + 54, billedTop - 44, 9));
  content.push(textLine(truncate(clientEmailLine, 42), left + 54, billedTop - 60, 9));

  // Table
  const tableLeft = left;
  const tableRight = right;
  const tableTop = billedTop - 92;

  content.push('0.72 0.70 0.68 RG 1 w\n');
  content.push(drawLine(tableLeft, tableTop + 12, tableRight, tableTop + 12));
  content.push(drawLine(tableLeft, tableTop - 6, tableRight, tableTop - 6));

  content.push('0.25 0.25 0.25 rg\n');
  content.push(textLine('TASK', tableLeft, tableTop, 9));
  content.push(textLine('RATE', tableLeft + 270, tableTop, 9));
  content.push(textLine('HOURS', tableLeft + 360, tableTop, 9));
  content.push(textLine('TOTAL', tableLeft + 445, tableTop, 9));

  const rowStartY = tableTop - 30;
  const rowHeight = 24;
  const maxRows = 8;

  // Row lines
  content.push('0.90 0.90 0.90 RG 0.6 w\n');
  for (let i = 0; i <= maxRows; i++) {
    const y = rowStartY - i * rowHeight;
    content.push(drawLine(tableLeft, y, tableRight, y));
  }

  content.push('0 0 0 rg\n');
  const lineItems = args.lineItems.slice(0, maxRows);
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    const y = rowStartY - i * rowHeight + 7;
    content.push(textLine(truncate(item.label, 40), tableLeft, y, 9));
    content.push(textLine(formatCurrencyFromCents(args.hourlyRateCents, args.currency), tableLeft + 270, y, 9));
    content.push(textLine(formatHours(item.hours), tableLeft + 360, y, 9));
    content.push(textLine(formatCurrencyFromCents(item.amountCents, args.currency), tableLeft + 445, y, 9));
  }

  const totalHours = args.lineItems.reduce((sum, li) => sum + li.hours, 0);
  const totalAmountCents = args.lineItems.reduce((sum, li) => sum + li.amountCents, 0);

  // Total due
  const totalsY = rowStartY - maxRows * rowHeight - 34;
  content.push('0.72 0.70 0.68 RG 1 w\n');
  content.push(drawLine(tableLeft, totalsY + 18, tableRight, totalsY + 18));
  content.push('0.25 0.25 0.25 rg\n');
  content.push(textLine('TOTAL DUE:', tableLeft, totalsY, 9));
  content.push('0 0 0 rg\n');
  content.push(textLine(formatCurrencyFromCents(totalAmountCents, args.currency), tableLeft + 445, totalsY, 10));

  // Payment information
  const paymentY = totalsY - 36;
  const payment = parsePayment(args.paymentInstructions);
  content.push('0.25 0.25 0.25 rg\n');
  content.push(textLine('PAYMENT INFORMATION:', tableLeft, paymentY, 9));

  const paymentLabelsX = tableLeft;
  const paymentValuesX = tableLeft + 92;
  const paymentStartY = paymentY - 18;
  const paymentRow = 14;

  content.push(textLine('Bank:', paymentLabelsX, paymentStartY, 8));
  content.push(textLine('Account Name:', paymentLabelsX, paymentStartY - paymentRow, 8));
  content.push(textLine('Routing Number:', paymentLabelsX, paymentStartY - paymentRow * 2, 8));
  content.push(textLine('Account Number:', paymentLabelsX, paymentStartY - paymentRow * 3, 8));

  content.push('0 0 0 rg\n');
  content.push(textLine(truncate(payment.bank, 44), paymentValuesX, paymentStartY, 8));
  content.push(textLine(truncate(payment.accountName, 44), paymentValuesX, paymentStartY - paymentRow, 8));
  content.push(textLine(truncate(payment.routingNumber, 44), paymentValuesX, paymentStartY - paymentRow * 2, 8));
  content.push(textLine(truncate(payment.accountNumber, 44), paymentValuesX, paymentStartY - paymentRow * 3, 8));

  // Extra payment lines (if provided)
  const extraY = paymentStartY - paymentRow * 4 - 4;
  for (let i = 0; i < Math.min(2, payment.extra.length); i++) {
    content.push(textLine(truncate(payment.extra[i], 80), tableLeft, extraY - i * 12, 8));
  }

  // Footer
  content.push('0.60 0.60 0.60 rg\n');
  const footerY = margin + 26;
  content.push(drawLine(margin + 14, footerY + 32, pageWidth - margin - 14, footerY + 32));
  content.push('0.25 0.25 0.25 rg\n');
  const fromLocationLines = (args.fromLocation ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);
  const fromLeftLines = fromLocationLines.slice(0, 2);
  const fromRightLines = fromLocationLines.slice(2, 4);

  if (fromLeftLines[0]) content.push(textLine(truncate(fromLeftLines[0], 42), tableLeft, footerY + 10, 8));
  if (fromLeftLines[1]) content.push(textLine(truncate(fromLeftLines[1], 42), tableLeft, footerY - 2, 8));

  if (fromRightLines[0]) content.push(textLine(truncate(fromRightLines[0], 42), tableLeft + 330, footerY + 10, 8));
  if (fromRightLines[1]) content.push(textLine(truncate(fromRightLines[1], 42), tableLeft + 330, footerY - 2, 8));

  const pdfBytes = buildSimplePdf({ contentStream: content.join(''), pageWidth, pageHeight });
  const filename = sanitizeFilename(`${args.invoiceNumber}.pdf`);
  downloadBlob(filename, new Blob([pdfBytes], { type: 'application/pdf' }));
}
