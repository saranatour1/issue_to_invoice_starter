import type { Doc, Id } from '../../../../convex/_generated/dataModel';

export type InvoiceCurrency = 'USD';
export type InvoiceStatus = 'saved' | 'sent' | 'paid' | 'void';
export type InvoiceStatusFilter = 'all' | 'drafts' | InvoiceStatus;

export type EnrichedTimeEntry = Doc<'timeEntries'> & { issueTitle: string | null; projectName: string | null };

export type InvoiceDraftTimeEntrySnapshot = {
  _id: Id<'timeEntries'>;
  issueId: Id<'issues'> | null;
  issueTitle: string | null;
  description: string | null;
  startedAt: number;
  endedAt: number;
  projectId: Id<'projects'> | null;
};

export type InvoiceDraft = {
  draftId: string;
  createdAt: number;
  projectId: Id<'projects'>;
  projectName: string;
  clientName?: string | null;
  clientLocation?: string | null;
  fromLocation?: string | null;
  paymentInstructions?: string | null;
  currency: InvoiceCurrency;
  hourlyRateCents: number;
  periodStart: number;
  periodEnd: number;
  timeEntries: Array<InvoiceDraftTimeEntrySnapshot>;
  source: 'local_draft';
};

export type InvoiceListRow =
  | {
      kind: 'draft';
      id: string;
      createdAt: number;
      projectId: Id<'projects'>;
      projectName: string;
      label: string;
    }
  | {
      kind: 'invoice';
      id: Id<'invoices'>;
      createdAt: number;
      projectId: Id<'projects'>;
      projectName: string;
      label: string;
      status: InvoiceStatus;
      invoiceNumber: string;
    };
