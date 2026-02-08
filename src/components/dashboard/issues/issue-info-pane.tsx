import {
  RiAddLine,
  RiCloseLine,
  RiPlayLine,
  RiStarFill,
  RiStarLine,
  RiStopLine,
} from '@remixicon/react';

import { AssigneeStack, IssueLabelsPills, PriorityPill, StatusIcon, labelForPriority } from './issue-ui';
import { useIssuesDashboard } from './issues-context';
import type { IssueStatus } from './types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDuration, formatEstimate, formatInteger, timeAgo } from '@/lib/dashboardFormat';

export function IssueInfoPane() {
  const {
    selectedIssueId,
    selectedIssue,
    closeIssue,
    viewerId,
    favoriteIssueIdSet,
    toggleIssueFavorite,
    setIssueStatus,
    setIssueAssignees,
    startTimer,
    stopTimer,
    activeTimer,
    now,
    projectById,
    userById,
    issueLabelsInput,
    setIssueLabelsInput,
    handleSaveIssueLabels,
    setIssueLabelsPending,
    setIssueLabelsError,
    subIssuesLoading,
    subIssues,
    newSubIssueTitle,
    setNewSubIssueTitle,
    newSubIssuePriority,
    setNewSubIssuePriority,
    handleCreateSubIssue,
    createSubIssuePending,
    createSubIssueError,
    blockedByPickerNonce,
    setBlockedByPickerNonce,
    relatedPickerNonce,
    setRelatedPickerNonce,
    blockedByIssuesLoading,
    blockedByIssues,
    relatedIssuesLoading,
    relatedIssues,
    blockedByCandidateIssues,
    relatedCandidateIssues,
    toggleIssueLink,
    openIssue,
    issueTimeEntriesLoading,
    issueTimeEntries,
  } = useIssuesDashboard();

  if (!selectedIssueId || !selectedIssue) {
    return (
      <div className="min-h-0 overflow-auto p-4">
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
          Select an issue to see actions and metadata.
        </div>
      </div>
    );
  }

  const isFavorite = favoriteIssueIdSet.has(selectedIssueId);
  const projectName = selectedIssue.projectId ? projectById.get(selectedIssue.projectId)?.name ?? 'Project' : 'No project';
  const activeForThisIssue = activeTimer?.issueId === selectedIssueId && activeTimer.endedAt === null ? activeTimer : null;

  return (
    <div className="min-h-0 overflow-auto p-4">
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">Actions</p>
            <p className="mt-0.5 truncate text-[0.625rem] text-muted-foreground">{selectedIssue.title}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => toggleIssueFavorite.mutate({ issueId: selectedIssueId })}
              disabled={toggleIssueFavorite.isPending}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? <RiStarFill className="text-amber-500" /> : <RiStarLine />}
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={() => closeIssue()} title="Close">
              <RiCloseLine />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[0.625rem] font-medium text-muted-foreground">Status</p>
              <Select
                value={selectedIssue.status}
                onValueChange={(value) => setIssueStatus.mutate({ issueId: selectedIssueId, status: value as IssueStatus })}
              >
                <SelectTrigger size="sm" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-[0.625rem] font-medium text-muted-foreground">Project</p>
              <p className="mt-2 truncate text-xs">{projectName}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!viewerId) return;
                const prev = selectedIssue.assigneeIds;
                const next = prev.includes(viewerId) ? prev.filter((id) => id !== viewerId) : [...prev, viewerId];
                setIssueAssignees.mutate({ issueId: selectedIssueId, assigneeIds: next });
              }}
              disabled={!viewerId || setIssueAssignees.isPending}
            >
              Assign to me
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => startTimer.mutate({ issueId: selectedIssueId })}
              disabled={startTimer.isPending}
              title="Start timer"
            >
              <RiPlayLine />
              Start timer
            </Button>

            {activeForThisIssue ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => stopTimer.mutate({ timeEntryId: activeForThisIssue._id })}
                disabled={stopTimer.isPending}
                title="Stop timer"
              >
                <RiStopLine />
                Stop
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{labelForPriority(selectedIssue.priority)}</Badge>
            {selectedIssue.estimateMinutes ? <Badge variant="outline">{formatEstimate(selectedIssue.estimateMinutes)}</Badge> : null}
            <AssigneeStack assigneeIds={selectedIssue.assigneeIds} userById={userById} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-muted/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium">Labels</p>
          <span className="text-[0.625rem] text-muted-foreground">Comma separated</span>
        </div>
        <IssueLabelsPills labels={selectedIssue.labels ?? []} className="mt-2" />
        <form onSubmit={handleSaveIssueLabels} className="mt-2 flex items-center gap-2">
          <Input
            value={issueLabelsInput}
            onChange={(e) => setIssueLabelsInput(e.target.value)}
            placeholder="bug, billing, frontend…"
            aria-label="Issue labels"
          />
          <Button size="sm" type="submit" variant="outline" disabled={setIssueLabelsPending}>
            Save
          </Button>
        </form>
        {setIssueLabelsError ? <p className="mt-2 text-[0.625rem] text-destructive">Couldn’t update labels.</p> : null}
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-muted/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium">Sub-issues</p>
          <Badge variant="outline">{formatInteger(subIssues.length)}</Badge>
        </div>

        {subIssuesLoading ? <p className="mt-2 text-xs text-muted-foreground">Loading…</p> : null}
        {!subIssuesLoading && subIssues.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No sub-issues yet.</p>
        ) : null}

        <div className="mt-2 grid gap-2">
          {subIssues.slice(0, 20).map((sub) => {
            const estimate = sub.estimateMinutes ? formatEstimate(sub.estimateMinutes) : null;
            return (
              <button
                key={sub._id}
                type="button"
                onClick={() => openIssue(sub._id)}
                className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background px-2 py-2 text-left text-xs transition-colors hover:bg-muted/20"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground" aria-hidden>
                      <StatusIcon status={sub.status as any} />
                    </span>
                    <span className="truncate font-medium">{sub.title}</span>
                    <PriorityPill priority={sub.priority as any} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.625rem] text-muted-foreground">
                    <span className="tabular-nums">{timeAgo(sub.lastActivityAt, now)}</span>
                    {estimate ? <Badge variant="outline">{estimate}</Badge> : null}
                  </div>
                  <IssueLabelsPills labels={sub.labels ?? []} max={2} className="mt-1" />
                </div>
                <AssigneeStack assigneeIds={sub.assigneeIds} userById={userById} />
              </button>
            );
          })}
        </div>

        <form onSubmit={handleCreateSubIssue} className="mt-3 flex items-center gap-2">
          <Input
            value={newSubIssueTitle}
            onChange={(e) => setNewSubIssueTitle(e.target.value)}
            placeholder="New sub-issue…"
            aria-label="Sub-issue title"
          />
          <Select value={newSubIssuePriority} onValueChange={(value) => setNewSubIssuePriority(value as any)}>
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
          <Button size="icon" variant="outline" disabled={createSubIssuePending} type="submit" title="Add sub-issue">
            <RiAddLine />
          </Button>
        </form>
        {createSubIssueError ? <p className="mt-2 text-[0.625rem] text-destructive">Couldn’t create sub-issue.</p> : null}
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-muted/10 p-3">
        <p className="text-xs font-medium">Links</p>
        <div className="mt-2 grid gap-3">
          <div className="rounded-md border border-border/60 bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.625rem] font-medium text-muted-foreground">Blocked by</p>
              <Select
                key={blockedByPickerNonce}
                onValueChange={(value) => {
                  toggleIssueLink.mutate({ issueId: selectedIssueId, otherIssueId: value as any, type: 'blocked_by' });
                  setBlockedByPickerNonce((n) => n + 1);
                }}
              >
                <SelectTrigger
                  size="sm"
                  disabled={blockedByCandidateIssues.length === 0 || toggleIssueLink.isPending}
                >
                  <SelectValue placeholder="Add blocker…" />
                </SelectTrigger>
                <SelectContent>
                  {blockedByCandidateIssues.map((issue) => (
                    <SelectItem key={issue._id} value={issue._id}>
                      {issue.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-2 grid gap-2">
              {blockedByIssuesLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
              {!blockedByIssuesLoading && blockedByIssues.length === 0 ? (
                <p className="text-xs text-muted-foreground">Not blocked.</p>
              ) : null}
              {blockedByIssues.map((blocker) => (
                <div
                  key={blocker._id}
                  role="button"
                  tabIndex={0}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/20"
                  onClick={() => openIssue(blocker._id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openIssue(blocker._id);
                    }
                  }}
                >
                  <span className="min-w-0 inline-flex items-center gap-2">
                    <span className="text-muted-foreground" aria-hidden>
                      <StatusIcon status={blocker.status as any} />
                    </span>
                    <span className="truncate font-medium">{blocker.title}</span>
                    <PriorityPill priority={blocker.priority as any} />
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleIssueLink.mutate({ issueId: selectedIssueId, otherIssueId: blocker._id, type: 'blocked_by' });
                    }}
                    disabled={toggleIssueLink.isPending}
                    title="Remove"
                  >
                    <RiCloseLine />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.625rem] font-medium text-muted-foreground">Related</p>
              <Select
                key={relatedPickerNonce}
                onValueChange={(value) => {
                  toggleIssueLink.mutate({ issueId: selectedIssueId, otherIssueId: value as any, type: 'related' });
                  setRelatedPickerNonce((n) => n + 1);
                }}
              >
                <SelectTrigger size="sm" disabled={relatedCandidateIssues.length === 0 || toggleIssueLink.isPending}>
                  <SelectValue placeholder="Add related…" />
                </SelectTrigger>
                <SelectContent>
                  {relatedCandidateIssues.map((issue) => (
                    <SelectItem key={issue._id} value={issue._id}>
                      {issue.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-2 grid gap-2">
              {relatedIssuesLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
              {!relatedIssuesLoading && relatedIssues.length === 0 ? (
                <p className="text-xs text-muted-foreground">No related issues.</p>
              ) : null}
              {relatedIssues.map((related) => (
                <div
                  key={related._id}
                  role="button"
                  tabIndex={0}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/20"
                  onClick={() => openIssue(related._id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openIssue(related._id);
                    }
                  }}
                >
                  <span className="min-w-0 inline-flex items-center gap-2">
                    <span className="text-muted-foreground" aria-hidden>
                      <StatusIcon status={related.status as any} />
                    </span>
                    <span className="truncate font-medium">{related.title}</span>
                    <PriorityPill priority={related.priority as any} />
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleIssueLink.mutate({ issueId: selectedIssueId, otherIssueId: related._id, type: 'related' });
                    }}
                    disabled={toggleIssueLink.isPending}
                    title="Remove"
                  >
                    <RiCloseLine />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {toggleIssueLink.error ? <p className="text-[0.625rem] text-destructive">Couldn’t update issue links.</p> : null}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-muted/10 p-3">
        <p className="text-xs font-medium">Time entries (you)</p>
        <div className="mt-2 grid gap-2">
          {issueTimeEntriesLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
          {!issueTimeEntriesLoading && issueTimeEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No time entries for this issue yet.</p>
          ) : null}
          {issueTimeEntries.slice(0, 10).map((entry) => {
            const durationMs = entry.endedAt === null ? now - entry.startedAt : entry.endedAt - entry.startedAt;
            return (
              <div
                key={entry._id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate">{entry.description ?? 'Time entry'}</p>
                  <p className="truncate text-[0.625rem] text-muted-foreground">{new Date(entry.startedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {entry.endedAt === null ? <Badge variant="secondary">Running</Badge> : null}
                  <span className="text-[0.625rem] text-muted-foreground tabular-nums">
                    {formatDuration(Math.max(0, durationMs))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
