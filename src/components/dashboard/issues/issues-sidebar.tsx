import { useState } from 'react';
import { RiAddLine, RiSearchLine, RiStarFill, RiStarLine } from '@remixicon/react';

import { AssigneeStack, PriorityPill, StatusIcon } from './issue-ui';
import { useIssuesDashboard } from './issues-context';
import type { IssuePriority, IssueStatusFilter } from './types';

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
import { Textarea } from '@/components/ui/textarea';
import { formatEstimate, timeAgo } from '@/lib/dashboardFormat';
import { cn } from '@/lib/utils';

export function IssuesSidebar({ mode = 'sidebar' }: { mode?: 'sidebar' | 'mobile' }) {
  const {
    projectId,
    projects,
    selectedProjectId,
    changeProject,
    issueSearch,
    setIssueSearch,
    issueStatusFilter,
    setIssueStatusFilter,
    issueFavoritesOnly,
    setIssueFavoritesOnly,
    issuesLayout,
    setIssuesLayout,
    newIssueTitle,
    setNewIssueTitle,
    newIssuePriority,
    setNewIssuePriority,
    newIssueEstimate,
    setNewIssueEstimate,
    newIssueDescription,
    setNewIssueDescription,
    newIssueLabels,
    setNewIssueLabels,
    handleCreateIssue,
    createIssuePending,
    createIssueError,
    issuesLoading,
    filteredIssues,
    selectedIssueId,
    openIssue,
    closeIssue,
    userById,
    now,
  } = useIssuesDashboard();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectedProjectLabel = selectedProjectId
    ? projects.find((p) => p._id === selectedProjectId)?.name ?? 'Current project'
    : 'All issues';

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">Issues</p>
        <p className="truncate text-[0.625rem] text-muted-foreground">{selectedProjectLabel}</p>
      </div>
      <div className="min-w-0 w-40 shrink-0">
        <Select
          value={projectId}
          onValueChange={(value) => {
            if (!value) return;
            changeProject(value);
          }}
        >
          <SelectTrigger size="sm" className="w-full max-w-full">
            <SelectValue>{selectedProjectLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All issues</SelectItem>
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

  const addIssue = (
    <form onSubmit={handleCreateIssue} className="grid gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={newIssueTitle}
          onChange={(e) => setNewIssueTitle(e.target.value)}
          placeholder="Create an issue…"
          aria-label="Issue title"
        />
        <Button size="icon" disabled={createIssuePending} type="submit" title="Add issue">
          <RiAddLine />
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-[0.625rem] text-muted-foreground hover:text-foreground"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? 'Hide details' : 'Add details'}
        </button>
        {selectedProjectId ? null : (
          <span className="text-[0.625rem] text-muted-foreground">Creating in “All issues”</span>
        )}
      </div>

      {advancedOpen ? (
        <>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <Select value={newIssuePriority} onValueChange={(value) => setNewIssuePriority(value as IssuePriority)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={newIssueEstimate}
              onChange={(e) => setNewIssueEstimate(e.target.value)}
              placeholder="Est. min"
              inputMode="numeric"
            />
          </div>
          <Input
            value={newIssueLabels}
            onChange={(e) => setNewIssueLabels(e.target.value)}
            placeholder="Labels (comma separated)…"
            aria-label="Issue labels"
          />
          <Textarea
            value={newIssueDescription}
            onChange={(e) => setNewIssueDescription(e.target.value)}
            placeholder="Description (optional)…"
            className="min-h-20"
          />
        </>
      ) : null}

      {createIssueError ? <p className="text-[0.625rem] text-destructive">Couldn’t create issue.</p> : null}
    </form>
  );

  const filters = (
    <div className="grid gap-2">
      <div className="relative">
        <RiSearchLine className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
        <Input
          value={issueSearch}
          onChange={(e) => setIssueSearch(e.target.value)}
          placeholder="Search…"
          className="pl-7"
        />
      </div>

      <Select
        value={issueStatusFilter}
        onValueChange={(value) => setIssueStatusFilter(value as IssueStatusFilter)}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={issueFavoritesOnly ? 'secondary' : 'outline'}
          className="gap-1"
          onClick={() => {
            setIssueFavoritesOnly((prev) => {
              return !prev;
            });
          }}
          title={issueFavoritesOnly ? 'Showing favorites' : 'Show favorites'}
        >
          {issueFavoritesOnly ? <RiStarFill className="size-4 text-amber-500" /> : <RiStarLine className="size-4" />}
          Favorites
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant={issuesLayout === 'list' ? 'secondary' : 'outline'} onClick={() => setIssuesLayout('list')}>
            List
          </Button>
          <Button size="sm" variant={issuesLayout === 'table' ? 'secondary' : 'outline'} onClick={() => setIssuesLayout('table')}>
            Table
          </Button>
          <Button
            size="sm"
            variant={issuesLayout === 'board' ? 'secondary' : 'outline'}
            onClick={() => {
              setIssueStatusFilter('all');
              setIssuesLayout('board');
            }}
          >
            Board
          </Button>
        </div>
      </div>
    </div>
  );

  const issueList = (
    <div className="grid gap-1">
      {issuesLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
      {!issuesLoading && filteredIssues.length === 0 ? <p className="text-xs text-muted-foreground">No issues.</p> : null}
      {filteredIssues.map((issue) => {
        const selected = issue._id === selectedIssueId;
        const estimate = issue.estimateMinutes ? formatEstimate(issue.estimateMinutes) : null;
        return (
          <button
            key={issue._id}
            type="button"
            onClick={() => {
              if (selected) {
                closeIssue();
                return;
              }
              openIssue(issue._id);
            }}
            className={cn(
              'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
              selected ? 'bg-muted/30' : 'hover:bg-muted/20',
            )}
            aria-current={selected ? 'true' : undefined}
          >
            <span className="mt-0.5 text-muted-foreground" aria-hidden>
              <StatusIcon status={issue.status} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{issue.title}</span>
                <PriorityPill priority={issue.priority} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.625rem] text-muted-foreground">
                <span className="tabular-nums">{timeAgo(issue.lastActivityAt, now)}</span>
                {estimate ? <Badge variant="outline">{estimate}</Badge> : null}
              </div>
            </div>
            <div className="mt-0.5 hidden shrink-0 sm:block">
              <AssigneeStack assigneeIds={issue.assigneeIds} userById={userById} />
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
          <p className="text-xs font-medium">Add issue</p>
          <div className="mt-2">{addIssue}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
          <p className="text-xs font-medium">Filters</p>
          <div className="mt-2">{filters}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
          <p className="text-xs font-medium">Issues</p>
          <div className="mt-2">{issueList}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarHeader>{header}</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Add issue</SidebarGroupLabel>
          <SidebarGroupContent>{addIssue}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Filters</SidebarGroupLabel>
          <SidebarGroupContent>{filters}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Issues</SidebarGroupLabel>
          <SidebarGroupContent className="max-h-[calc(100svh-22rem)] overflow-auto">
            {issueList}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
