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

function buildSimplePdf(contentStream: string) {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(contentStream);

  const objects: Record<number, string> = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    4: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    5: `<< /Length ${contentBytes.length} >>\nstream\n${contentStream}\nendstream`,
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

function truncate(text: string, maxLen: number) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function exportInvoicePdf(args: {
  invoiceNumber: string;
  projectName: string;
  periodStart: number;
  periodEnd: number;
  hourlyRateCents: number;
  currency: string;
  lineItems: Array<InvoiceLineItem>;
  timezone?: string | null;
}) {
  const zone = args.timezone || undefined;
  const periodStart = DateTime.fromMillis(args.periodStart, { zone }).toISODate() ?? '';
  const periodEndInclusive = DateTime.fromMillis(args.periodEnd, { zone }).minus({ days: 1 }).toISODate() ?? '';

  const content: Array<string> = [];
  content.push(textLine('Invoice', 50, 760, 24));
  content.push(textLine(args.invoiceNumber, 50, 735, 12));
  content.push(textLine(args.projectName, 50, 718, 12));
  content.push(textLine(`${periodStart} – ${periodEndInclusive}`, 50, 701, 11));

  const tableTopY = 670;
  content.push(textLine('Item', 50, tableTopY, 11));
  content.push(textLine('Hours', 360, tableTopY, 11));
  content.push(textLine('Rate', 430, tableTopY, 11));
  content.push(textLine('Amount', 500, tableTopY, 11));

  let y = tableTopY - 18;
  for (const item of args.lineItems) {
    if (y < 80) break;
    content.push(textLine(truncate(item.label, 48), 50, y, 10));
    content.push(textLine(formatHours(item.hours), 360, y, 10));
    content.push(textLine(formatCurrencyFromCents(args.hourlyRateCents, args.currency), 430, y, 10));
    content.push(textLine(formatCurrencyFromCents(item.amountCents, args.currency), 500, y, 10));
    y -= 16;
  }

  const totalHours = args.lineItems.reduce((sum, li) => sum + li.hours, 0);
  const totalAmountCents = args.lineItems.reduce((sum, li) => sum + li.amountCents, 0);

  content.push(textLine(`Total hours: ${formatHours(totalHours)}`, 50, 90, 11));
  content.push(textLine(`Total: ${formatCurrencyFromCents(totalAmountCents, args.currency)}`, 50, 72, 12));

  const pdfBytes = buildSimplePdf(content.join(''));
  const filename = sanitizeFilename(`${args.invoiceNumber}.pdf`);
  downloadBlob(filename, new Blob([pdfBytes], { type: 'application/pdf' }));
}
