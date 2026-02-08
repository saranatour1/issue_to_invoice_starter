import { useMemo } from 'react';
import { RiAddLine, RiFileDownloadLine, RiSearchLine } from '@remixicon/react';

import { useInvoicesDashboard } from './invoices-context';
import type { InvoiceDraftRangePreset } from './invoices-context';
import type { InvoiceStatusFilter } from './types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function InvoicesSidebar({ mode = 'sidebar' }: { mode?: 'sidebar' | 'mobile' }) {
  const {
    projectId,
    projects,
    selectedProjectId,
    changeProject,
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
    rowsLoading,
    visibleRows,
    selectedDraftId,
    selectedInvoiceId,
    openDraft,
    openInvoice,
    closeSelection,
  } = useInvoicesDashboard();

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">Invoices</p>
        <p className="truncate text-[0.625rem] text-muted-foreground">
          {selectedProjectId ? projects.find((p) => p._id === selectedProjectId)?.name ?? 'Project' : 'All invoices'}
        </p>
      </div>
      <div className="w-40 shrink-0">
        <Select value={projectId} onValueChange={(value) => value && changeProject(value)}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All invoices</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p._id} value={p._id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const showProjectPicker = !selectedProjectId;

  const newInvoice = (
    <form onSubmit={handleCreateDraft} className="grid gap-2">
      {showProjectPicker ? (
        <Select value={draftProjectId} onValueChange={(value) => value && setDraftProjectId(value)}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p._id} value={p._id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select value={draftRangePreset} onValueChange={(value) => setDraftRangePreset(value as InvoiceDraftRangePreset)}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this_week">This week</SelectItem>
          <SelectItem value="last_week">Last week</SelectItem>
          <SelectItem value="this_month">This month</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {draftRangePreset === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={draftCustomStart} onChange={(e) => setDraftCustomStart(e.target.value)} />
          <Input type="date" value={draftCustomEnd} onChange={(e) => setDraftCustomEnd(e.target.value)} />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Input
          value={draftHourlyRate}
          onChange={(e) => setDraftHourlyRate(e.target.value)}
          placeholder="Hourly rate (USD)"
          inputMode="decimal"
        />
        <Button size="icon" type="submit" disabled={createDraftPending} title="Create draft">
          <RiAddLine />
        </Button>
      </div>

      {createDraftMessage ? <p className="text-[0.625rem] text-muted-foreground">{createDraftMessage}</p> : null}
    </form>
  );

  const filters = (
    <div className="grid gap-2">
      <div className="relative">
        <RiSearchLine className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
        <Input
          value={invoiceSearch}
          onChange={(e) => setInvoiceSearch(e.target.value)}
          placeholder="Search…"
          className="pl-7"
        />
      </div>

      <Select value={invoiceStatusFilter} onValueChange={(value) => setInvoiceStatusFilter(value as InvoiceStatusFilter)}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="drafts">Drafts (local)</SelectItem>
          <SelectItem value="saved">Saved</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="void">Void</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const selectedKey = useMemo(() => {
    if (selectedInvoiceId) return `invoice:${selectedInvoiceId}`;
    if (selectedDraftId) return `draft:${selectedDraftId}`;
    return null;
  }, [selectedDraftId, selectedInvoiceId]);

  const list = (
    <div className="grid gap-1">
      {rowsLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
      {!rowsLoading && visibleRows.length === 0 ? <p className="text-xs text-muted-foreground">No invoices.</p> : null}
      {visibleRows.map((row) => {
        const key = row.kind === 'draft' ? `draft:${row.id}` : `invoice:${row.id}`;
        const selected = key === selectedKey;
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (selected) {
                closeSelection();
                return;
              }
              if (row.kind === 'draft') {
                openDraft(row.id);
                return;
              }
              openInvoice(row.id);
            }}
            className={cn(
              'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
              selected ? 'bg-muted/30' : 'hover:bg-muted/20',
            )}
            aria-current={selected ? 'true' : undefined}
          >
            <span className="mt-0.5 text-muted-foreground" aria-hidden>
              <RiFileDownloadLine className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{row.label}</span>
                {row.kind === 'invoice' ? (
                  <Badge variant="outline" className="capitalize">
                    {row.status.replace('_', ' ')}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Draft</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.625rem] text-muted-foreground">
                <span className="truncate">{row.projectName}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  if (mode === 'mobile') {
    return (
      <div className="grid gap-4">
        {header}
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
          <p className="text-xs font-medium">New invoice draft</p>
          <div className="mt-2">{newInvoice}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
          <p className="text-xs font-medium">Filters</p>
          <div className="mt-2">{filters}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
          <p className="text-xs font-medium">Invoices</p>
          <div className="mt-2">{list}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarHeader>{header}</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>New invoice draft</SidebarGroupLabel>
          <SidebarGroupContent>{newInvoice}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Filters</SidebarGroupLabel>
          <SidebarGroupContent>{filters}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Invoices</SidebarGroupLabel>
          <SidebarGroupContent className="max-h-[calc(100svh-20rem)] overflow-auto">
            {list}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
