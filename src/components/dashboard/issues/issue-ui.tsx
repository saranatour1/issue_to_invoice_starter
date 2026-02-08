import { useMemo } from 'react';
import {
  RiCheckboxCircleLine,
  RiCircleLine,
  RiCloseCircleLine,
  RiLoader4Line,
} from '@remixicon/react';

import type { Id } from '../../../../convex/_generated/dataModel';
import type { IssuePriority, IssueStatus, MinimalUser } from './types';

import { Badge } from '@/components/ui/badge';
import { formatInteger, shortId } from '@/lib/dashboardFormat';
import { cn } from '@/lib/utils';

export function StatusIcon({ status }: { status: IssueStatus }) {
  const className = 'size-4';
  switch (status) {
    case 'open':
      return <RiCircleLine className={className} />;
    case 'in_progress':
      return <RiLoader4Line className={cn(className, 'animate-spin')} />;
    case 'done':
      return <RiCheckboxCircleLine className={className} />;
    case 'closed':
      return <RiCloseCircleLine className={className} />;
    default:
      return <RiCircleLine className={className} />;
  }
}

export function labelForPriority(priority: IssuePriority) {
  switch (priority) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
    case 'urgent':
      return 'Urgent';
    default:
      return priority;
  }
}

export function PriorityPill({ priority }: { priority: IssuePriority }) {
  const label = labelForPriority(priority);
  const tone =
    priority === 'urgent'
      ? 'bg-destructive/15 text-destructive'
      : priority === 'high'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'bg-muted/40 text-muted-foreground';
  return <span className={cn('rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium', tone)}>{label}</span>;
}

export function labelForStatus(status: IssueStatus) {
  switch (status) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In progress';
    case 'done':
      return 'Done';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
}

export function IssueLabelsPills({
  labels,
  max,
  className,
}: {
  labels: Array<string>;
  max?: number;
  className?: string;
}) {
  if (!labels.length) return null;
  const visible = typeof max === 'number' ? labels.slice(0, max) : labels;
  const hidden = labels.length - visible.length;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {visible.map((label, index) => (
        <Badge
          key={`${label.toLowerCase()}-${index}`}
          variant="outline"
          className="h-5 rounded-md px-1.5 text-[0.625rem]"
        >
          {label}
        </Badge>
      ))}
      {hidden > 0 ? <span className="text-[0.625rem] text-muted-foreground">+{formatInteger(hidden)}</span> : null}
    </div>
  );
}

export function UserAvatar({ userId, user }: { userId: string | null; user: MinimalUser | null }) {
  const label = user?.name ?? user?.email ?? userId ?? '?';
  const initials = getInitials(label);

  if (user?.pictureUrl) {
    return (
      <img
        src={user.pictureUrl}
        alt={label}
        className="size-7 shrink-0 rounded-full border border-border/60 object-cover"
      />
    );
  }

  return (
    <div className="bg-muted/40 text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-[0.625rem] font-medium">
      {initials}
    </div>
  );
}

function getInitials(label: string) {
  const parts = label.trim().split(/\s+/g).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

export function AssigneeStack({
  assigneeIds,
  userById,
}: {
  assigneeIds: Array<string>;
  userById: Map<string, MinimalUser>;
}) {
  if (!assigneeIds.length) {
    return <span className="text-[0.625rem] text-muted-foreground">Unassigned</span>;
  }

  const visible = assigneeIds.slice(0, 3);
  const rest = assigneeIds.length - visible.length;

  return (
    <div className="flex items-center">
      {visible.map((id, index) => (
        <div key={id} className={cn(index > 0 && '-ml-2')}>
          <UserAvatar userId={id} user={userById.get(id) ?? null} />
        </div>
      ))}
      {rest > 0 ? <span className="ml-2 text-[0.625rem] text-muted-foreground">+{formatInteger(rest)}</span> : null}
    </div>
  );
}

export function CommentThread({
  comments,
  userById,
  onReply,
}: {
  comments: Array<{
    _id: Id<'issueComments'>;
    parentCommentId: Id<'issueComments'> | null;
    authorId: string;
    body: string;
    deletedAt: number | null;
    editedAt: number | null;
  }>;
  userById: Map<string, MinimalUser>;
  onReply: (commentId: Id<'issueComments'>) => void;
}) {
  const byParent = useMemo(() => {
    const map = new Map<string | null, typeof comments>();
    for (const c of comments) {
      const key = c.parentCommentId ?? null;
      const bucket = map.get(key) ?? [];
      bucket.push(c);
      map.set(key, bucket);
    }
    return map;
  }, [comments]);

  const render = (parentId: Id<'issueComments'> | null, depth: number) => {
    const bucket = byParent.get(parentId) ?? [];
    if (!bucket.length) return null;

    return (
      <div className={cn(depth > 0 && 'mt-2 border-l border-border/60 pl-3')}>
        {bucket.map((c) => {
          const author = userById.get(c.authorId) ?? null;
          return (
            <div key={c._id} className="mt-2 rounded-md border border-border/60 bg-muted/10 p-2">
              <div className="flex items-start gap-2">
                <UserAvatar userId={c.authorId} user={author} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-foreground">
                      {author?.name ?? author?.email ?? shortId(c.authorId)}
                    </p>
                    <button
                      type="button"
                      className="text-[0.625rem] text-muted-foreground hover:text-foreground"
                      onClick={() => onReply(c._id)}
                    >
                      Reply
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{c.body}</p>
                </div>
              </div>
              {render(c._id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return <div className="mt-2">{render(null, 0)}</div>;
}
