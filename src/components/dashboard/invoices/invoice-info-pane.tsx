import { useEffect, useMemo, useRef, useState } from 'react';
import { RiCheckLine, RiCloseLine, RiDeleteBinLine, RiDownloadLine, RiLoader4Line, RiPencilLine, RiSaveLine } from '@remixicon/react';

import { useInvoicesDashboard } from './invoices-context';
import { buildLineItems, draftDisplayNumber, exportInvoiceCsv, totalsFromLineItems } from './invoice-ui';
import { exportInvoicePdf } from './invoice-pdf';
import type { InvoiceStatus } from './types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
    updateLocalDraft,
    updateInvoice,
  } = useInvoicesDashboard();

  const [exportError, setExportError] = useState<string | null>(null);
  const [invoiceDetailsEditing, setInvoiceDetailsEditing] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientLocation, setClientLocation] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const detailsSaveRequested = useRef(false);

  useEffect(() => {
    if (!selectedInvoice) {
      setInvoiceDetailsEditing(false);
      setClientName('');
      setClientLocation('');
      setFromLocation('');
      setPaymentInstructions('');
      return;
    }

    const projectName = projects.find((p) => p._id === selectedInvoice.projectId)?.name ?? 'Project';

    setInvoiceDetailsEditing(false);
    setClientName(selectedInvoice.clientName ?? projectName);
    setClientLocation(selectedInvoice.clientLocation ?? '');
    setFromLocation(selectedInvoice.fromLocation ?? '');
    setPaymentInstructions(selectedInvoice.paymentInstructions ?? '');
  }, [projects, selectedInvoice]);

  useEffect(() => {
    if (!detailsSaveRequested.current) return;
    if (updateInvoice.isPending) return;

    if (updateInvoice.error) {
      detailsSaveRequested.current = false;
      return;
    }

    detailsSaveRequested.current = false;
    setInvoiceDetailsEditing(false);
  }, [updateInvoice.error, updateInvoice.isPending]);

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

        <div className="mt-4 grid gap-3">
          <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-xs font-medium">Client, locations, payment</p>
            <p className="mt-1 text-[0.625rem] text-muted-foreground">
              Draft details are stored locally on this device until you click “Save invoice”.
            </p>

            <div className="mt-3 grid gap-2">
              <div className="grid gap-1">
                <p className="text-[0.625rem] text-muted-foreground">Client name</p>
                <Input
                  value={selectedDraft.clientName ?? selectedDraft.projectName}
                  onChange={(e) => updateLocalDraft(selectedDraft.draftId, { clientName: e.target.value })}
                  placeholder="Client name"
                />
              </div>

              <div className="grid gap-1">
                <p className="text-[0.625rem] text-muted-foreground">Client location</p>
                <Textarea
                  value={selectedDraft.clientLocation ?? ''}
                  onChange={(e) => updateLocalDraft(selectedDraft.draftId, { clientLocation: e.target.value })}
                  placeholder="Client address (optional email on last line)"
                  className="min-h-20"
                />
              </div>

              <div className="grid gap-1">
                <p className="text-[0.625rem] text-muted-foreground">Your location</p>
                <Textarea
                  value={selectedDraft.fromLocation ?? ''}
                  onChange={(e) => updateLocalDraft(selectedDraft.draftId, { fromLocation: e.target.value })}
                  placeholder={'Your details (used in PDF footer)\nName\nPhone\nEmail\nLocation'}
                  className="min-h-20"
                />
              </div>

              <div className="grid gap-1">
                <p className="text-[0.625rem] text-muted-foreground">Payment info (instructions)</p>
                <Textarea
                  value={selectedDraft.paymentInstructions ?? ''}
                  onChange={(e) => updateLocalDraft(selectedDraft.draftId, { paymentInstructions: e.target.value })}
                  placeholder={'Bank\nAccount Name\nRouting Number\nAccount Number\n(optional extra notes or a payment link)'}
                  className="min-h-20"
                />
                <p className="text-[0.625rem] text-muted-foreground">
                  Tip: PDF export maps line 1→Bank, 2→Account Name, 3→Routing #, 4→Account #. You can also use “Bank: …” style keys.
                </p>
                <p className="text-[0.625rem] text-muted-foreground">
                  Avoid storing full card numbers or sensitive banking credentials; prefer payment links or high-level instructions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
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
                  clientName: selectedDraft.clientName ?? selectedDraft.projectName,
                  clientLocation: selectedDraft.clientLocation ?? null,
                  fromLocation: selectedDraft.fromLocation ?? null,
                  paymentInstructions: selectedDraft.paymentInstructions ?? null,
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

        <div className="mt-4 grid gap-3">
          <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Client, locations, payment</p>
              {!invoiceDetailsEditing ? (
                <Button size="sm" variant="outline" onClick={() => setInvoiceDetailsEditing(true)}>
                  <RiPencilLine className="size-4" />
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      detailsSaveRequested.current = true;
                      updateInvoice.mutate({
                        invoiceId: selectedInvoice._id,
                        clientName: clientName.trim() ? clientName.trim() : null,
                        clientLocation: clientLocation.trim() ? clientLocation.trim() : null,
                        fromLocation: fromLocation.trim() ? fromLocation.trim() : null,
                        paymentInstructions: paymentInstructions.trim() ? paymentInstructions.trim() : null,
                      });
                    }}
                    disabled={updateInvoice.isPending}
                  >
                    <RiCheckLine className="size-4" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setInvoiceDetailsEditing(false);
                      setClientName(selectedInvoice.clientName ?? projectName);
                      setClientLocation(selectedInvoice.clientLocation ?? '');
                      setFromLocation(selectedInvoice.fromLocation ?? '');
                      setPaymentInstructions(selectedInvoice.paymentInstructions ?? '');
                    }}
                    disabled={updateInvoice.isPending}
                  >
                    <RiCloseLine className="size-4" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <p className="mt-1 text-[0.625rem] text-muted-foreground">These details are only visible to you (invoice creator).</p>

            <div className="mt-3 grid gap-2">
              <div className="grid gap-1">
                <p className="text-[0.625rem] text-muted-foreground">Client name</p>
                {invoiceDetailsEditing ? (
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
                ) : (
                  <p className="text-xs">{selectedInvoice.clientName ?? projectName}</p>
                )}
              </div>

              <div className="grid gap-1">
                <p className="text-[0.625rem] text-muted-foreground">Client location</p>
                {invoiceDetailsEditing ? (
                  <Textarea
                    value={clientLocation}
                    onChange={(e) => setClientLocation(e.target.value)}
                    placeholder="Client address (optional email on last line)"
                    className="min-h-20"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-xs">{selectedInvoice.clientLocation ?? '—'}</p>
                )}
              </div>

              <div className="grid gap-1">
                <p className="text-[0.625rem] text-muted-foreground">Your location</p>
                {invoiceDetailsEditing ? (
                  <Textarea
                    value={fromLocation}
                    onChange={(e) => setFromLocation(e.target.value)}
                    placeholder={'Your details (used in PDF footer)\nName\nPhone\nEmail\nLocation'}
                    className="min-h-20"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-xs">{selectedInvoice.fromLocation ?? '—'}</p>
                )}
              </div>

              <div className="grid gap-1">
                <p className="text-[0.625rem] text-muted-foreground">Payment info (instructions)</p>
                {invoiceDetailsEditing ? (
                  <Textarea
                    value={paymentInstructions}
                    onChange={(e) => setPaymentInstructions(e.target.value)}
                    placeholder={'Bank\nAccount Name\nRouting Number\nAccount Number\n(optional extra notes or a payment link)'}
                    className="min-h-20"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-xs">{selectedInvoice.paymentInstructions ?? '—'}</p>
                )}
                <p className="text-[0.625rem] text-muted-foreground">
                  Tip: PDF export maps line 1→Bank, 2→Account Name, 3→Routing #, 4→Account #. You can also use “Bank: …” style keys.
                </p>
                <p className="text-[0.625rem] text-muted-foreground">
                  Avoid storing full card numbers or sensitive banking credentials; prefer payment links or high-level instructions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
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
                  clientName: selectedInvoice.clientName ?? projectName,
                  clientLocation: selectedInvoice.clientLocation ?? null,
                  fromLocation: selectedInvoice.fromLocation ?? null,
                  paymentInstructions: selectedInvoice.paymentInstructions ?? null,
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
      </div>
    );
  }

  return (
    <div className="p-4 text-xs text-muted-foreground">
      Select an invoice or draft to see actions.
    </div>
  );
}
