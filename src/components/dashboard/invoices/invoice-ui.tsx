import { DateTime } from 'luxon';

import type { Id } from '../../../../convex/_generated/dataModel';
import type { EnrichedTimeEntry, InvoiceDraftTimeEntrySnapshot } from './types';
import { formatCurrencyFromCents, formatHours } from '@/lib/dashboardFormat';

export type InvoiceLineItem = {
  key: string;
  label: string;
  issueId: Id<'issues'> | null;
  totalDurationMs: number;
  hours: number;
  hourlyRateCents: number;
  amountCents: number;
};

export function draftDisplayNumber(draftId: string) {
  return `DRAFT-${draftId.slice(0, 8)}`;
}

export function createDraftId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `draft_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function parseHourlyRateToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[$,]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const [dollarsPart, centsPartRaw] = normalized.split('.') as [string, string | undefined];
  const dollars = Number(dollarsPart);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  const centsPart = (centsPartRaw ?? '').padEnd(2, '0').slice(0, 2);
  const cents = Number(centsPart || '0');
  if (!Number.isFinite(cents) || cents < 0) return null;
  return Math.round(dollars * 100) + cents;
}

function durationMs(entry: { startedAt: number; endedAt: number | null }) {
  if (entry.endedAt === null) return 0;
  return Math.max(0, entry.endedAt - entry.startedAt);
}

export function buildLineItems(
  entries: Array<Pick<EnrichedTimeEntry, '_id' | 'issueId' | 'issueTitle' | 'startedAt' | 'endedAt' | 'description'>> |
    Array<InvoiceDraftTimeEntrySnapshot>,
  hourlyRateCents: number,
): Array<InvoiceLineItem> {
  const groups = new Map<string, { issueId: Id<'issues'> | null; label: string; totalDurationMs: number }>();

  for (const entry of entries) {
    const issueId = entry.issueId ?? null;
    const key = issueId ?? 'general';
    const prev = groups.get(key);
    const nextLabel = issueId ? entry.issueTitle ?? 'Issue' : 'General';
    const nextDuration = durationMs(entry);

    if (!prev) {
      groups.set(key, { issueId, label: nextLabel, totalDurationMs: nextDuration });
      continue;
    }

    prev.totalDurationMs += nextDuration;
  }

  const items: Array<InvoiceLineItem> = [];
  for (const [key, group] of groups) {
    const hours = group.totalDurationMs / 3_600_000;
    const amountCents = Math.round(hours * hourlyRateCents);
    items.push({
      key,
      label: group.label,
      issueId: group.issueId,
      totalDurationMs: group.totalDurationMs,
      hours,
      hourlyRateCents,
      amountCents,
    });
  }

  items.sort((a, b) => b.totalDurationMs - a.totalDurationMs);
  return items;
}

export function totalsFromLineItems(items: Array<InvoiceLineItem>) {
  const totalDurationMs = items.reduce((sum, item) => sum + item.totalDurationMs, 0);
  const totalHours = totalDurationMs / 3_600_000;
  const totalAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0);
  return { totalDurationMs, totalHours, totalAmountCents };
}

function csvEscape(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export function exportInvoiceCsv(args: {
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

  const header = ['invoiceNumber', 'projectName', 'periodStart', 'periodEnd', 'label', 'hours', 'hourlyRate', 'amount'];
  const rows = args.lineItems.map((item) => [
    args.invoiceNumber,
    args.projectName,
    periodStart,
    periodEndInclusive,
    item.label,
    formatHours(item.hours),
    formatCurrencyFromCents(args.hourlyRateCents, args.currency),
    formatCurrencyFromCents(item.amountCents, args.currency),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
    .join('\n');

  const filename = `${args.invoiceNumber}.csv`.replace(/[^a-zA-Z0-9._-]/g, '_');
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}
