import { useMemo, useState } from 'react';
import { RiDeleteBinLine, RiDownloadLine, RiLoader4Line, RiSaveLine } from '@remixicon/react';

import { useInvoicesDashboard } from './invoices-context';
import { buildLineItems, draftDisplayNumber, exportInvoiceCsv, totalsFromLineItems } from './invoice-ui';
import { exportInvoicePdf } from './invoice-pdf';
import type { InvoiceStatus } from './types';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrencyFromCents, formatHours } from '@/lib/dashboardFormat';

export function InvoiceInfoPane() {
  const {
    timezone,
    projects,
    selectedDraft,
    selectedInvoice,
    selectedInvoiceEntries,
    selectedInvoiceEntriesLoading,
    finalizeDraft,
    deleteLocalDraft,
    updateInvoice,
  } = useInvoicesDashboard();

  const [exportError, setExportError] = useState<string | null>(null);

  const draftLineItems = useMemo(() => {
    if (!selectedDraft) return null;
    const items = buildLineItems(selectedDraft.timeEntries, selectedDraft.hourlyRateCents);
    const totals = totalsFromLineItems(items);
    return { items, totals };
  }, [selectedDraft]);

  const invoiceLineItems = useMemo(() => {
    if (!selectedInvoice) return null;
    const items = buildLineItems(selectedInvoiceEntries, selectedInvoice.hourlyRateCents);
    const totals = totalsFromLineItems(items);
    return { items, totals };
  }, [selectedInvoice, selectedInvoiceEntries]);

  if (selectedDraft && draftLineItems) {
    const invoiceNumber = draftDisplayNumber(selectedDraft.draftId);
    return (
      <div className="p-4">
        <p className="text-xs font-medium">Draft actions</p>
        <p className="mt-1 text-[0.625rem] text-muted-foreground">
          {formatHours(draftLineItems.totals.totalHours)} hours •{' '}
          {formatCurrencyFromCents(draftLineItems.totals.totalAmountCents, selectedDraft.currency)}
        </p>

        <div className="mt-4 grid gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setExportError(null);
              try {
                exportInvoiceCsv({
                  invoiceNumber,
                  projectName: selectedDraft.projectName,
                  periodStart: selectedDraft.periodStart,
                  periodEnd: selectedDraft.periodEnd,
                  hourlyRateCents: selectedDraft.hourlyRateCents,
                  currency: selectedDraft.currency,
                  lineItems: draftLineItems.items,
                  timezone,
                });
              } catch {
                setExportError('Could not export CSV.');
              }
            }}
          >
            <RiDownloadLine className="size-4" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setExportError(null);
              try {
                exportInvoicePdf({
                  invoiceNumber,
                  projectName: selectedDraft.projectName,
                  periodStart: selectedDraft.periodStart,
                  periodEnd: selectedDraft.periodEnd,
                  hourlyRateCents: selectedDraft.hourlyRateCents,
                  currency: selectedDraft.currency,
                  lineItems: draftLineItems.items,
                  timezone,
                });
              } catch {
                setExportError('Could not export PDF.');
              }
            }}
          >
            <RiDownloadLine className="size-4" />
            Export PDF
          </Button>

          <Button
            onClick={() => finalizeDraft.mutate({ draft: selectedDraft })}
            disabled={finalizeDraft.isPending}
          >
            {finalizeDraft.isPending ? <RiLoader4Line className="size-4 animate-spin" /> : <RiSaveLine className="size-4" />}
            Save invoice
          </Button>

          <Button
            variant="destructive"
            onClick={() => deleteLocalDraft(selectedDraft.draftId)}
            disabled={finalizeDraft.isPending}
          >
            <RiDeleteBinLine className="size-4" />
            Delete draft
          </Button>

          {exportError ? <p className="text-[0.625rem] text-destructive">{exportError}</p> : null}
          {finalizeDraft.error ? <p className="text-[0.625rem] text-destructive">Could not save invoice.</p> : null}
        </div>
      </div>
    );
  }

  if (selectedInvoice && invoiceLineItems) {
    const projectName = projects.find((p) => p._id === selectedInvoice.projectId)?.name ?? 'Project';
    const canExport = !selectedInvoiceEntriesLoading;

    return (
      <div className="p-4">
        <p className="text-xs font-medium">Invoice</p>
        <p className="mt-1 text-[0.625rem] text-muted-foreground">{selectedInvoice.invoiceNumber}</p>
        <p className="mt-1 text-[0.625rem] text-muted-foreground">{projectName}</p>

        <div className="mt-4 grid gap-2">
          <Select
            value={selectedInvoice.status as InvoiceStatus}
            onValueChange={(value) => updateInvoice.mutate({ invoiceId: selectedInvoice._id, status: value as InvoiceStatus })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="saved">Saved</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            disabled={!canExport}
            onClick={() => {
              setExportError(null);
              try {
                exportInvoiceCsv({
                  invoiceNumber: selectedInvoice.invoiceNumber,
                  projectName,
                  periodStart: selectedInvoice.periodStart,
                  periodEnd: selectedInvoice.periodEnd,
                  hourlyRateCents: selectedInvoice.hourlyRateCents,
                  currency: selectedInvoice.currency,
                  lineItems: invoiceLineItems.items,
                  timezone,
                });
              } catch {
                setExportError('Could not export CSV.');
              }
            }}
          >
            <RiDownloadLine className="size-4" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            disabled={!canExport}
            onClick={() => {
              setExportError(null);
              try {
                exportInvoicePdf({
                  invoiceNumber: selectedInvoice.invoiceNumber,
                  projectName,
                  periodStart: selectedInvoice.periodStart,
                  periodEnd: selectedInvoice.periodEnd,
                  hourlyRateCents: selectedInvoice.hourlyRateCents,
                  currency: selectedInvoice.currency,
                  lineItems: invoiceLineItems.items,
                  timezone,
                });
              } catch {
                setExportError('Could not export PDF.');
              }
            }}
          >
            <RiDownloadLine className="size-4" />
            Export PDF
          </Button>

          {selectedInvoiceEntriesLoading ? (
            <p className="text-[0.625rem] text-muted-foreground">Loading time entries…</p>
          ) : (
            <p className="text-[0.625rem] text-muted-foreground">
              {formatHours(invoiceLineItems.totals.totalHours)} hours •{' '}
              {formatCurrencyFromCents(invoiceLineItems.totals.totalAmountCents, selectedInvoice.currency)}
            </p>
          )}

          {exportError ? <p className="text-[0.625rem] text-destructive">{exportError}</p> : null}
          {updateInvoice.error ? <p className="text-[0.625rem] text-destructive">Could not update invoice.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 text-xs text-muted-foreground">
      Select an invoice or draft to see actions.
    </div>
  );
}
