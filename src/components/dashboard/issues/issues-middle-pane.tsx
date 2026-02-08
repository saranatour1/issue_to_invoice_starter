import { RiArrowLeftLine, RiStarFill, RiStarLine } from '@remixicon/react';

import {
  AssigneeStack,
  CommentThread,
  IssueLabelsPills,
  PriorityPill,
  StatusIcon,
  labelForStatus,
} from './issue-ui';
import { useIssuesDashboard } from './issues-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { formatEstimate, formatInteger, timeAgo } from '@/lib/dashboardFormat';
import { cn } from '@/lib/utils';

export function IssuesMiddlePane() {
  const {
    issuesLayout,
    issuesLoading,
    issueStatusFilter,
    issuesByStatus,
    filteredIssues,
    selectedIssueId,
    selectedIssueLoading,
    selectedIssue,
    parentIssue,
    projectById,
    now,
    openIssue,
    closeIssue,
    favoriteIssueIdSet,
    toggleIssueFavorite,
    userById,
    selectedIssueComments,
    newCommentBody,
    setNewCommentBody,
    replyToCommentId,
    setReplyToCommentId,
    handleAddComment,
    addIssueCommentPending,
    addIssueCommentError,
  } = useIssuesDashboard();

  if (issuesLayout === 'board' && !selectedIssueId) {
    const statuses =
      issueStatusFilter === 'all'
        ? (['open', 'in_progress', 'done', 'closed'] as const)
        : ([issueStatusFilter] as const);

    return (
      <div className="min-h-0 overflow-auto p-4">
        {issuesLoading ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
            No issues yet.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statuses.map((status) => {
              const items = issuesByStatus[status];
              return (
                <div key={status} className="w-72 shrink-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.625rem] font-medium text-muted-foreground">{labelForStatus(status)}</p>
                    <Badge variant="outline">{formatInteger(items.length)}</Badge>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {items.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2 text-[0.625rem] text-muted-foreground">
                        No issues
                      </div>
                    ) : null}
                    {items.map((issue) => {
                      const projectName = issue.projectId ? (projectById.get(issue.projectId)?.name ?? 'Project') : null;
                      const estimate = issue.estimateMinutes ? formatEstimate(issue.estimateMinutes) : null;
                      const isFavorite = favoriteIssueIdSet.has(issue._id);
                      return (
                        <button
                          key={issue._id}
                          type="button"
                          onClick={() => openIssue(issue._id)}
                          className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-left text-xs transition-colors hover:bg-muted/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{issue.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.625rem] text-muted-foreground">
                                {projectName ? <span className="truncate">{projectName}</span> : null}
                                <span className="tabular-nums">{timeAgo(issue.lastActivityAt, now)}</span>
                                {estimate ? <Badge variant="outline">{estimate}</Badge> : null}
                              </div>
                              <IssueLabelsPills labels={issue.labels ?? []} max={2} className="mt-1" />
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleIssueFavorite.mutate({ issueId: issue._id });
                                }}
                                disabled={toggleIssueFavorite.isPending}
                                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                {isFavorite ? <RiStarFill className="size-4 text-amber-500" /> : <RiStarLine className="size-4" />}
                              </Button>
                              <PriorityPill priority={issue.priority} />
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <AssigneeStack assigneeIds={issue.assigneeIds} userById={userById} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (!selectedIssueId) {
    return (
      <div className="min-h-0 overflow-auto p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium">Issues</p>
            <p className="mt-0.5 text-[0.625rem] text-muted-foreground">
              {issuesLoading ? 'Loading…' : `${formatInteger(filteredIssues.length)} shown`}
            </p>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {issueStatusFilter === 'all' ? 'All' : labelForStatus(issueStatusFilter)}
          </Badge>
        </div>

        <div className="mt-3 grid gap-2">
          {!issuesLoading && filteredIssues.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
              No issues match your filters.
            </div>
          ) : null}

          {filteredIssues.map((issue) => {
            const projectName = issue.projectId ? (projectById.get(issue.projectId)?.name ?? 'Project') : null;
            const estimate = issue.estimateMinutes ? formatEstimate(issue.estimateMinutes) : null;
            return (
              <button
                key={issue._id}
                type="button"
                onClick={() => openIssue(issue._id)}
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-3 text-left text-xs transition-colors hover:bg-muted/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="mt-0.5 text-muted-foreground" aria-hidden>
                      <StatusIcon status={issue.status} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{issue.title}</span>
                        <PriorityPill priority={issue.priority} />
                        {estimate ? <Badge variant="outline">{estimate}</Badge> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.625rem] text-muted-foreground">
                        {projectName ? <span className="truncate">{projectName}</span> : null}
                        <span className="tabular-nums">{timeAgo(issue.lastActivityAt, now)}</span>
                      </div>
                      <IssueLabelsPills labels={issue.labels ?? []} max={4} className="mt-2" />
                    </div>
                  </div>
                  <div className="hidden shrink-0 sm:block">
                    <AssigneeStack assigneeIds={issue.assigneeIds} userById={userById} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (selectedIssueLoading) {
    return (
      <div className="min-h-0 overflow-auto p-4">
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
          Loading issue…
        </div>
      </div>
    );
  }

  if (!selectedIssue) {
    return (
      <div className="min-h-0 overflow-auto p-4">
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
          Issue not found.
        </div>
      </div>
    );
  }

  const projectName = selectedIssue.projectId ? projectById.get(selectedIssue.projectId)?.name ?? 'Project' : 'No project';

  return (
    <div className="min-h-0 overflow-auto p-4">
      {selectedIssue.parentIssueId ? (
        <button
          type="button"
          className="mb-3 inline-flex items-center gap-1 text-[0.625rem] text-muted-foreground hover:text-foreground"
          onClick={() => {
            const parentId = selectedIssue.parentIssueId;
            if (!parentId) return;
            openIssue(parentId);
          }}
          title="Go to parent issue"
        >
          <RiArrowLeftLine className="size-3.5" />
          <span className="truncate">{parentIssue?.title ?? 'Parent issue'}</span>
        </button>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{selectedIssue.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{projectName}</p>
        </div>
        <Button size="icon" variant="ghost" className="md:hidden" onClick={() => closeIssue()} title="Close issue">
          ✕
        </Button>
      </div>

      {selectedIssue.description ? (
        <p className="mt-4 whitespace-pre-wrap text-xs text-muted-foreground">{selectedIssue.description}</p>
      ) : null}

      <Separator className="my-4" />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Comments</p>
        {replyToCommentId ? (
          <button
            type="button"
            className="text-[0.625rem] text-muted-foreground hover:text-foreground"
            onClick={() => setReplyToCommentId(null)}
          >
            Cancel reply
          </button>
        ) : null}
      </div>

      <CommentThread comments={selectedIssueComments} userById={userById} onReply={(commentId) => setReplyToCommentId(commentId)} />

      <form onSubmit={handleAddComment} className="mt-3 grid gap-2">
        <Textarea
          value={newCommentBody}
          onChange={(e) => setNewCommentBody(e.target.value)}
          placeholder={replyToCommentId ? 'Write a reply…' : 'Write a comment…'}
          className="min-h-20"
        />
        <div className="flex items-center justify-between gap-2">
          <div className={cn('text-[0.625rem] text-muted-foreground')}>
            {replyToCommentId ? 'Replying in thread' : 'Commenting on issue'}
          </div>
          <Button size="sm" disabled={addIssueCommentPending} type="submit">
            Post
          </Button>
        </div>
        {addIssueCommentError ? <p className="text-[0.625rem] text-destructive">Couldn’t post comment.</p> : null}
      </form>
    </div>
  );
}
