import { createContext, useContext } from 'react';
import type { SubmitEvent } from 'react';

import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import type {
  EnrichedTimeEntry,
  InvoiceDraft,
  InvoiceListRow,
  InvoiceStatus,
  InvoiceStatusFilter,
} from './types';

export type InvoiceDraftRangePreset = 'this_week' | 'last_week' | 'this_month' | 'custom';

export type InvoicesDashboardContextValue = {
  projectId: string;
  projects: Array<Doc<'projects'>>;
  selectedProjectId: Id<'projects'> | null;

  viewerId: string | null;
  timezone: string | null;

  changeProject: (projectId: string) => void;
  openInvoice: (invoiceId: Id<'invoices'>) => void;
  openDraft: (draftId: string) => void;
  closeSelection: () => void;

  invoiceStatusFilter: InvoiceStatusFilter;
  setInvoiceStatusFilter: (value: InvoiceStatusFilter) => void;
  invoiceSearch: string;
  setInvoiceSearch: (value: string) => void;

  draftProjectId: string;
  setDraftProjectId: (value: string) => void;
  draftRangePreset: InvoiceDraftRangePreset;
  setDraftRangePreset: (value: InvoiceDraftRangePreset) => void;
  draftCustomStart: string;
  setDraftCustomStart: (value: string) => void;
  draftCustomEnd: string;
  setDraftCustomEnd: (value: string) => void;
  draftHourlyRate: string;
  setDraftHourlyRate: (value: string) => void;
  handleCreateDraft: (event: SubmitEvent) => void;
  createDraftPending: boolean;
  createDraftMessage: string | null;

  rowsLoading: boolean;
  visibleRows: Array<InvoiceListRow>;

  localDrafts: Array<InvoiceDraft>;

  selectedDraftId: string | null;
  selectedInvoiceId: Id<'invoices'> | null;
  selectedDraft: InvoiceDraft | null;
  selectedInvoiceLoading: boolean;
  selectedInvoice: Doc<'invoices'> | null;
  selectedInvoiceEntriesLoading: boolean;
  selectedInvoiceEntries: Array<EnrichedTimeEntry>;

  deleteLocalDraft: (draftId: string) => void;
  updateLocalDraft: (
    draftId: string,
    patch: Partial<Pick<InvoiceDraft, 'clientName' | 'clientLocation' | 'fromLocation' | 'paymentInstructions' | 'hourlyRateCents'>>,
  ) => void;

  finalizeDraft: {
    mutate: (args: { draft: InvoiceDraft }) => void;
    isPending: boolean;
    error: unknown;
  };

  updateInvoice: {
    mutate: (args: {
      invoiceId: Id<'invoices'>;
      status?: InvoiceStatus;
      hourlyRateCents?: number;
      notes?: string | null;
      clientName?: string | null;
      clientLocation?: string | null;
      fromLocation?: string | null;
      paymentInstructions?: string | null;
    }) => void;
    isPending: boolean;
    error: unknown;
  };
};

const InvoicesDashboardContext = createContext<InvoicesDashboardContextValue | null>(null);

export function useInvoicesDashboard() {
  const ctx = useContext(InvoicesDashboardContext);
  if (!ctx) {
    throw new Error('useInvoicesDashboard must be used within <InvoicesDashboard>.');
  }
  return ctx;
}

export { InvoicesDashboardContext };
