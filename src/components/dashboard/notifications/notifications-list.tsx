import { RiArrowRightSLine } from '@remixicon/react';

import type { MinimalUser } from '@/components/dashboard/issues/types';
import type { Doc } from '../../../../convex/_generated/dataModel';
import { UserAvatar } from '@/components/dashboard/issues/issue-ui';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/dashboardFormat';
import { cn } from '@/lib/utils';

function labelForType(type: Doc<'notifications'>['type']) {
  switch (type) {
    case 'comment_added':
      return 'Comment';
    case 'comment_replied':
      return 'Reply';
    case 'reaction_added':
      return 'Reaction';
    case 'issue_assigned':
      return 'Assignment';
    case 'issue_status_changed':
      return 'Status';
    case 'issue_created':
      return 'Issue';
    case 'mentioned':
      return 'Mention';
    default:
      return type;
  }
}

export function NotificationsList({
  notifications,
  loading,
  userById,
  now,
  onOpenNotification,
}: {
  notifications: Array<Doc<'notifications'>>;
  loading: boolean;
  userById: Map<string, MinimalUser>;
  now: number;
  onOpenNotification: (notification: Doc<'notifications'>) => void;
}) {
  if (loading && notifications.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
        Loading notifications…
      </div>
    );
  }

  if (!loading && notifications.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
        No notifications in this view.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
      {notifications.map((notification) => {
        const actor = notification.actorId ? userById.get(notification.actorId) ?? null : null;
        const isUnread = notification.readAt === null;
        return (
          <button
            key={notification._id}
            type="button"
            onClick={() => onOpenNotification(notification)}
            className={cn(
              'flex w-full items-start gap-3 border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/30',
              isUnread && 'bg-muted/20',
            )}
          >
            <UserAvatar userId={notification.actorId} user={actor} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-medium text-foreground">{notification.title}</span>
                <Badge variant="outline">{labelForType(notification.type)}</Badge>
                {isUnread ? <Badge variant="secondary">New</Badge> : null}
              </div>
              {notification.body ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
              ) : null}
              <p className="mt-1 text-[0.625rem] tabular-nums text-muted-foreground">
                {timeAgo(notification._creationTime, now)}
              </p>
            </div>
            <RiArrowRightSLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}
