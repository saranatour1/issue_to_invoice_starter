import { DateTime } from 'luxon';

import { useInvoicesDashboard } from './invoices-context';
import { buildLineItems, draftDisplayNumber, totalsFromLineItems } from './invoice-ui';
import { formatCurrencyFromCents, formatHours } from '@/lib/dashboardFormat';
import { cn } from '@/lib/utils';

function formatPeriod(periodStart: number, periodEnd: number, timezone: string | null) {
  const zone = timezone || undefined;
  const start = DateTime.fromMillis(periodStart, { zone }).toLocaleString(DateTime.DATE_MED);
  const end = DateTime.fromMillis(periodEnd, { zone }).minus({ days: 1 }).toLocaleString(DateTime.DATE_MED);
  return `${start} – ${end}`;
}

export function InvoiceMiddlePane() {
  const { projects, timezone, selectedDraft, selectedInvoiceLoading, selectedInvoice, selectedInvoiceEntriesLoading, selectedInvoiceEntries } =
    useInvoicesDashboard();

  if (selectedDraft) {
    const lineItems = buildLineItems(selectedDraft.timeEntries, selectedDraft.hourlyRateCents);
    const totals = totalsFromLineItems(lineItems);
    const clientName = selectedDraft.clientName ?? selectedDraft.projectName;
    return (
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{draftDisplayNumber(selectedDraft.draftId)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{selectedDraft.projectName}</p>
            {clientName !== selectedDraft.projectName ? (
              <p className="mt-1 text-xs text-muted-foreground">Client: {clientName}</p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">{formatPeriod(selectedDraft.periodStart, selectedDraft.periodEnd, timezone)}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Rate: {formatCurrencyFromCents(selectedDraft.hourlyRateCents, selectedDraft.currency)}</p>
            <p>Total: {formatCurrencyFromCents(totals.totalAmountCents, selectedDraft.currency)}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-[1fr_6rem_7rem_7rem] gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 text-[0.625rem] font-medium text-muted-foreground">
            <span>Item</span>
            <span className="text-right">Hours</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="divide-y divide-border/60">
            {lineItems.map((item) => (
              <div key={item.key} className="grid grid-cols-[1fr_6rem_7rem_7rem] gap-2 px-3 py-2 text-xs">
                <span className="truncate font-medium">{item.label}</span>
                <span className="text-right tabular-nums">{formatHours(item.hours)}</span>
                <span className="text-right tabular-nums">{formatCurrencyFromCents(item.hourlyRateCents, selectedDraft.currency)}</span>
                <span className="text-right tabular-nums">{formatCurrencyFromCents(item.amountCents, selectedDraft.currency)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-3 py-2 text-xs">
            <span className="font-medium">Total</span>
            <span className="tabular-nums text-muted-foreground">
              {formatHours(totals.totalHours)} hours • {formatCurrencyFromCents(totals.totalAmountCents, selectedDraft.currency)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (selectedInvoiceLoading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading invoice…</div>;
  }

  if (selectedInvoice) {
    const projectName = projects.find((p) => p._id === selectedInvoice.projectId)?.name ?? 'Project';
    const lineItems = buildLineItems(selectedInvoiceEntries, selectedInvoice.hourlyRateCents);
    const totals = totalsFromLineItems(lineItems);
    const clientName = selectedInvoice.clientName ?? projectName;
    return (
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{selectedInvoice.invoiceNumber}</p>
            <p className="mt-1 text-xs text-muted-foreground">{projectName}</p>
            {clientName !== projectName ? <p className="mt-1 text-xs text-muted-foreground">Client: {clientName}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">{formatPeriod(selectedInvoice.periodStart, selectedInvoice.periodEnd, timezone)}</p>
            <p className="mt-1 text-[0.625rem] text-muted-foreground capitalize">
              Status: {selectedInvoice.status.replace('_', ' ')}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Rate: {formatCurrencyFromCents(selectedInvoice.hourlyRateCents, selectedInvoice.currency)}</p>
            <p>Total: {formatCurrencyFromCents(totals.totalAmountCents, selectedInvoice.currency)}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
          {selectedInvoiceEntriesLoading ? <div className="p-3 text-xs text-muted-foreground">Loading entries…</div> : null}
          <div className="grid grid-cols-[1fr_6rem_7rem_7rem] gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 text-[0.625rem] font-medium text-muted-foreground">
            <span>Item</span>
            <span className="text-right">Hours</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="divide-y divide-border/60">
            {lineItems.map((item) => (
              <div key={item.key} className="grid grid-cols-[1fr_6rem_7rem_7rem] gap-2 px-3 py-2 text-xs">
                <span className="truncate font-medium">{item.label}</span>
                <span className="text-right tabular-nums">{formatHours(item.hours)}</span>
                <span className="text-right tabular-nums">{formatCurrencyFromCents(item.hourlyRateCents, selectedInvoice.currency)}</span>
                <span className="text-right tabular-nums">{formatCurrencyFromCents(item.amountCents, selectedInvoice.currency)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-3 py-2 text-xs">
            <span className="font-medium">Total</span>
            <span className="tabular-nums text-muted-foreground">
              {formatHours(totals.totalHours)} hours • {formatCurrencyFromCents(totals.totalAmountCents, selectedInvoice.currency)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-6')}>
      <p className="text-sm font-semibold">Invoices</p>
      <p className="mt-1 text-xs text-muted-foreground">Create a draft from your unbilled time, then export or save it.</p>
    </div>
  );
}
