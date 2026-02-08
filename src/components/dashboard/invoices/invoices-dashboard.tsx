import { useNavigate } from '@tanstack/react-router';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import { InvoicesDashboardContext } from './invoices-context';
import { InvoiceInfoPane } from './invoice-info-pane';
import { InvoiceMiddlePane } from './invoice-middle-pane';
import { InvoicesSidebar } from './invoices-sidebar';
import { createDraftId, draftDisplayNumber, parseHourlyRateToCents } from './invoice-ui';
import type { ReactNode, SubmitEvent } from 'react';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import type {
  EnrichedTimeEntry,
  InvoiceDraft,
  InvoiceListRow,
  InvoiceStatus,
  InvoiceStatusFilter,
} from './types';
import type { InvoiceDraftRangePreset } from './invoices-context';

const LOCAL_DRAFTS_STORAGE_PREFIX = 'cidt:invoiceDrafts:v1:';

export function InvoicesDashboard({
  projectId,
  invoiceIdParam,
  draftIdParam,
  projects,
  viewerId,
  children,
}: {
  projectId: string;
  invoiceIdParam: string | null;
  draftIdParam: string | null;
  projects: Array<Doc<'projects'>>;
  viewerId: string | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const selectedProjectId: Id<'projects'> | null = projectId === 'all' ? null : (projectId as Id<'projects'>);
  const projectById = useMemo(() => {
    const map = new Map<Id<'projects'>, Doc<'projects'>>();
    for (const project of projects) map.set(project._id, project);
    return map;
  }, [projects]);

  const changeProject = (nextProjectId: string) => {
    navigate({ to: '/$projectId/invoices', params: { projectId: nextProjectId } });
  };

  const openInvoice = (invoiceId: Id<'invoices'>) => {
    navigate({ to: '/$projectId/invoices/$invoiceId', params: { projectId, invoiceId } });
  };

  const openDraft = (draftId: string) => {
    navigate({ to: '/$projectId/invoices/draft/$draftId', params: { projectId, draftId } });
  };

  const closeSelection = () => {
    navigate({ to: '/$projectId/invoices', params: { projectId } });
  };

  const selectedInvoiceId = invoiceIdParam ? (invoiceIdParam as Id<'invoices'>) : null;
  const selectedDraftId = selectedInvoiceId ? null : draftIdParam;

  const viewerSettings = useQuery(convexQuery(api.users.getViewerSettings, {}));
  const timezone = viewerSettings.data?.timezone ?? null;

  const localStorageKey = viewerId ? `${LOCAL_DRAFTS_STORAGE_PREFIX}${viewerId}` : null;
  const [localDrafts, setLocalDrafts] = useState<Array<InvoiceDraft>>([]);
  const draftsLoadedRef = useRef(false);

  useEffect(() => {
    draftsLoadedRef.current = false;
    if (!localStorageKey || typeof window === 'undefined') {
      setLocalDrafts([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(localStorageKey);
      if (!raw) {
        setLocalDrafts([]);
        draftsLoadedRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setLocalDrafts([]);
        draftsLoadedRef.current = true;
        return;
      }
      setLocalDrafts(parsed as Array<InvoiceDraft>);
      draftsLoadedRef.current = true;
    } catch {
      setLocalDrafts([]);
      draftsLoadedRef.current = true;
    }
  }, [localStorageKey]);

  useEffect(() => {
    if (!localStorageKey || typeof window === 'undefined') return;
    if (!draftsLoadedRef.current) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(localStorageKey, JSON.stringify(localDrafts));
      } catch {
        // Ignore quota errors.
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [localDrafts, localStorageKey]);

  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceStatusFilter>('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const invoicesQueryArgs = useMemo(() => {
    const args: { projectId?: Id<'projects'>; status?: InvoiceStatus; limit: number } = { limit: 100 };
    if (selectedProjectId) args.projectId = selectedProjectId;
    if (invoiceStatusFilter !== 'all' && invoiceStatusFilter !== 'drafts') {
      args.status = invoiceStatusFilter;
    }
    return args;
  }, [invoiceStatusFilter, selectedProjectId]);

  const savedInvoices = useQuery(
    convexQuery(api.invoices.listForViewer, viewerId ? invoicesQueryArgs : 'skip'),
  );

  const [draftProjectId, setDraftProjectId] = useState('');
  const [draftRangePreset, setDraftRangePreset] = useState<InvoiceDraftRangePreset>('this_week');
  const [draftCustomStart, setDraftCustomStart] = useState('');
  const [draftCustomEnd, setDraftCustomEnd] = useState('');
  const [draftHourlyRate, setDraftHourlyRate] = useState('150');
  const [createDraftPending, setCreateDraftPending] = useState(false);
  const [createDraftMessage, setCreateDraftMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProjectId) {
      setDraftProjectId(selectedProjectId);
      return;
    }
    if (draftProjectId && projectById.has(draftProjectId as Id<'projects'>)) return;
    if (projects.length) setDraftProjectId(projects[0]._id);
  }, [draftProjectId, projectById, projects, selectedProjectId]);

  const usedTimeEntryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const draft of localDrafts) {
      for (const entry of draft.timeEntries) ids.add(entry._id);
    }
    return ids;
  }, [localDrafts]);

  const handleCreateDraft = async (event: SubmitEvent) => {
    event.preventDefault();
    setCreateDraftMessage(null);
    if (!viewerId) {
      setCreateDraftMessage('Sign in to create invoice drafts.');
      return;
    }

    const targetProjectId: Id<'projects'> | null = selectedProjectId
      ? selectedProjectId
      : draftProjectId
        ? (draftProjectId as Id<'projects'>)
        : null;

    if (!targetProjectId || !projectById.has(targetProjectId)) {
      setCreateDraftMessage('Select a project to invoice.');
      return;
    }

    const hourlyRateCents = parseHourlyRateToCents(draftHourlyRate);
    if (hourlyRateCents === null) {
      setCreateDraftMessage('Enter a valid hourly rate.');
      return;
    }

    const zone = timezone || undefined;
    const now = DateTime.now().setZone(zone);

    let start: any;
    let end: any;
    if (draftRangePreset === 'this_week') {
      start = now.startOf('week');
      end = start.plus({ weeks: 1 });
    } else if (draftRangePreset === 'last_week') {
      end = now.startOf('week');
      start = end.minus({ weeks: 1 });
    } else if (draftRangePreset === 'this_month') {
      start = now.startOf('month');
      end = start.plus({ months: 1 });
    } else {
      if (!draftCustomStart || !draftCustomEnd) {
        setCreateDraftMessage('Select a start and end date.');
        return;
      }
      start = DateTime.fromISO(draftCustomStart, { zone }).startOf('day');
      end = DateTime.fromISO(draftCustomEnd, { zone }).plus({ days: 1 }).startOf('day');
    }

    if (!start.isValid || !end.isValid || end <= start) {
      setCreateDraftMessage('Select a valid date range.');
      return;
    }

    setCreateDraftPending(true);
    try {
      const candidates = await queryClient.fetchQuery(
        convexQuery(api.time.listEndedForViewerInRange, {
          projectId: targetProjectId,
          start: start.toMillis(),
          end: end.toMillis(),
          limit: 500,
        }),
      );

      const filtered = candidates.filter((entry: EnrichedTimeEntry) => !usedTimeEntryIds.has(entry._id));
      if (filtered.length === 0) {
        setCreateDraftMessage('No unbilled time entries found for that range.');
        return;
      }

      const createdAt = Date.now();
      const draftId = createDraftId();
      const projectName = projectById.get(targetProjectId)!.name;

      const draft: InvoiceDraft = {
        draftId,
        createdAt,
        projectId: targetProjectId,
        projectName,
        clientName: projectName,
        clientLocation: null,
        fromLocation: null,
        paymentInstructions: null,
        currency: 'USD',
        hourlyRateCents,
        periodStart: start.toMillis(),
        periodEnd: end.toMillis(),
        timeEntries: filtered
          .filter((e: EnrichedTimeEntry) => e.endedAt !== null)
          .map((entry: EnrichedTimeEntry) => ({
            _id: entry._id,
            issueId: entry.issueId ?? null,
            issueTitle: entry.issueTitle ?? null,
            description: entry.description ?? null,
            startedAt: entry.startedAt,
            endedAt: entry.endedAt!,
            projectId: entry.projectId ?? null,
          })),
        source: 'local_draft',
      };

      setLocalDrafts((prev) => [draft, ...prev.filter((d) => d.draftId !== draftId)]);
      openDraft(draftId);
      setCreateDraftMessage(`Created ${draftDisplayNumber(draftId)}.`);
    } catch {
      setCreateDraftMessage('Could not create draft. Try again.');
    } finally {
      setCreateDraftPending(false);
    }
  };

  const baseDrafts = useMemo(() => {
    if (!selectedProjectId) return localDrafts;
    return localDrafts.filter((d) => d.projectId === selectedProjectId);
  }, [localDrafts, selectedProjectId]);

  const draftRows = useMemo(() => {
    return baseDrafts.map<InvoiceListRow>((draft) => ({
      kind: 'draft',
      id: draft.draftId,
      createdAt: draft.createdAt,
      projectId: draft.projectId,
      projectName: draft.projectName,
      label: draftDisplayNumber(draft.draftId),
    }));
  }, [baseDrafts]);

  const invoiceRows = useMemo(() => {
    return (savedInvoices.data ?? []).map<InvoiceListRow>((inv) => ({
      kind: 'invoice',
      id: inv._id as Id<'invoices'>,
      createdAt: inv.createdAt,
      projectId: inv.projectId,
      projectName: projectById.get(inv.projectId)?.name ?? 'Project',
      label: inv.invoiceNumber,
      status: inv.status as InvoiceStatus,
      invoiceNumber: inv.invoiceNumber,
    }));
  }, [projectById, savedInvoices.data]);

  const visibleRows = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    let rows: Array<InvoiceListRow> = [];

    if (invoiceStatusFilter === 'drafts') {
      rows = draftRows;
    } else if (invoiceStatusFilter === 'all') {
      rows = [...draftRows, ...invoiceRows];
    } else {
      rows = invoiceRows.filter((row) => row.kind === 'invoice' && row.status === invoiceStatusFilter);
    }

    if (q) {
      rows = rows.filter((row) => {
        const haystack = `${row.label} ${row.projectName}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  }, [draftRows, invoiceRows, invoiceSearch, invoiceStatusFilter]);

  const selectedDraft = useMemo(() => {
    if (!selectedDraftId) return null;
    return localDrafts.find((d) => d.draftId === selectedDraftId) ?? null;
  }, [localDrafts, selectedDraftId]);

  useEffect(() => {
    if (!selectedDraftId) return;
    if (!draftsLoadedRef.current) return;
    if (selectedDraft) return;
    navigate({ to: '/$projectId/invoices', params: { projectId }, replace: true });
  }, [navigate, projectId, selectedDraft, selectedDraftId]);

  const selectedInvoice = useQuery(
    convexQuery(api.invoices.get, viewerId && selectedInvoiceId ? { invoiceId: selectedInvoiceId } : 'skip'),
  );

  const selectedInvoiceEntries = useQuery(
    convexQuery(
      api.invoices.listTimeEntriesForInvoice,
      viewerId && selectedInvoiceId ? { invoiceId: selectedInvoiceId, limit: 200 } : 'skip',
    ),
  );

  useEffect(() => {
    if (!selectedInvoiceId) return;
    if (selectedInvoice.isLoading) return;
    if (selectedInvoice.data === null) {
      navigate({ to: '/$projectId/invoices', params: { projectId }, replace: true });
    }
  }, [navigate, projectId, selectedInvoice.data, selectedInvoice.isLoading, selectedInvoiceId]);

  const finalizeFromDraftFn = useConvexMutation(api.invoices.finalizeFromDraft);
  const finalizeDraft = useMutation({
    mutationFn: async (args: { draft: InvoiceDraft }) => {
      return await finalizeFromDraftFn({
        projectId: args.draft.projectId,
        periodStart: args.draft.periodStart,
        periodEnd: args.draft.periodEnd,
        hourlyRateCents: args.draft.hourlyRateCents,
        currency: args.draft.currency,
        timeEntryIds: args.draft.timeEntries.map((e) => e._id),
        clientName: args.draft.clientName ?? undefined,
        clientLocation: args.draft.clientLocation ?? undefined,
        fromLocation: args.draft.fromLocation ?? undefined,
        paymentInstructions: args.draft.paymentInstructions ?? undefined,
      });
    },
    onSuccess: async (invoiceId, variables) => {
      setLocalDrafts((prev) => prev.filter((d) => d.draftId !== variables.draft.draftId));
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
      openInvoice(invoiceId as Id<'invoices'>);
    },
  });

  const updateInvoiceFn = useConvexMutation(api.invoices.updateInvoice);
  const updateInvoice = useMutation({
    mutationFn: (args: {
      invoiceId: Id<'invoices'>;
      status?: InvoiceStatus;
      hourlyRateCents?: number;
      notes?: string | null;
      clientName?: string | null;
      clientLocation?: string | null;
      fromLocation?: string | null;
      paymentInstructions?: string | null;
    }) => updateInvoiceFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const deleteLocalDraft = (draftId: string) => {
    setLocalDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
    if (selectedDraftId === draftId) {
      closeSelection();
    }
  };

  const updateLocalDraft = (
    draftId: string,
    patch: Partial<Pick<InvoiceDraft, 'clientName' | 'clientLocation' | 'fromLocation' | 'paymentInstructions' | 'hourlyRateCents'>>,
  ) => {
    setLocalDrafts((prev) =>
      prev.map((draft) => {
        if (draft.draftId !== draftId) return draft;
        return { ...draft, ...patch };
      }),
    );
  };

  const ctxValue = useMemo(
    () => ({
      projectId,
      projects,
      selectedProjectId,
      viewerId,
      timezone,
      changeProject,
      openInvoice,
      openDraft,
      closeSelection,
      invoiceStatusFilter,
      setInvoiceStatusFilter,
      invoiceSearch,
      setInvoiceSearch,
      draftProjectId,
      setDraftProjectId,
      draftRangePreset,
      setDraftRangePreset,
      draftCustomStart,
      setDraftCustomStart,
      draftCustomEnd,
      setDraftCustomEnd,
      draftHourlyRate,
      setDraftHourlyRate,
      handleCreateDraft,
      createDraftPending,
      createDraftMessage,
      rowsLoading: savedInvoices.isLoading,
      visibleRows,
      localDrafts,
      selectedDraftId,
      selectedInvoiceId,
      selectedDraft,
      selectedInvoiceLoading: selectedInvoice.isLoading,
      selectedInvoice: selectedInvoice.data ?? null,
      selectedInvoiceEntriesLoading: selectedInvoiceEntries.isLoading,
      selectedInvoiceEntries: selectedInvoiceEntries.data ?? [],
      deleteLocalDraft,
      updateLocalDraft,
      finalizeDraft,
      updateInvoice,
    }),
    [
      changeProject,
      closeSelection,
      createDraftMessage,
      createDraftPending,
      draftCustomEnd,
      draftCustomStart,
      draftHourlyRate,
      draftProjectId,
      draftRangePreset,
      finalizeDraft,
      handleCreateDraft,
      invoiceSearch,
      invoiceStatusFilter,
      localDrafts,
      openDraft,
      openInvoice,
      projectId,
      projects,
      savedInvoices.isLoading,
      selectedDraft,
      selectedDraftId,
      selectedInvoice.data,
      selectedInvoice.isLoading,
      selectedInvoiceEntries.data,
      selectedInvoiceEntries.isLoading,
      selectedInvoiceId,
      selectedProjectId,
      timezone,
      updateLocalDraft,
      updateInvoice,
      visibleRows,
      viewerId,
    ],
  );

  return <InvoicesDashboardContext.Provider value={ctxValue}>{children}</InvoicesDashboardContext.Provider>;
}

export function InvoicesDashboardContent() {
  return (
    <div className="min-h-0 flex-1">
      <div className="md:hidden p-4">
        <InvoicesSidebar mode="mobile" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 overflow-auto">
          <InvoiceMiddlePane />
        </div>
        <div className="min-h-0 overflow-auto md:border-l md:border-border/60">
          <InvoiceInfoPane />
        </div>
      </div>
    </div>
  );
}
