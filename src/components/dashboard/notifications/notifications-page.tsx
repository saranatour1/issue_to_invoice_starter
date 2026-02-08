import { RiCheckDoubleLine } from '@remixicon/react';

import { NotificationsList } from './notifications-list';
import type { MinimalUser } from '@/components/dashboard/issues/types';
import type { Doc } from '../../../../convex/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function NotificationsPage({
  notifications,
  loading,
  now,
  userById,
  unreadOnly,
  setUnreadOnly,
  unreadCount,
  markAllPending,
  onMarkAllRead,
  canLoadMore,
  onLoadMore,
  onOpenNotification,
}: {
  notifications: Array<Doc<'notifications'>>;
  loading: boolean;
  now: number;
  userById: Map<string, MinimalUser>;
  unreadOnly: boolean;
  setUnreadOnly: (next: boolean) => void;
  unreadCount: number;
  markAllPending: boolean;
  onMarkAllRead: () => void;
  canLoadMore: boolean;
  onLoadMore: () => void;
  onOpenNotification: (notification: Doc<'notifications'>) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium">Notifications</p>
        <Badge variant="outline">{unreadCount} unread</Badge>
        <Button
          size="sm"
          variant={unreadOnly ? 'secondary' : 'outline'}
          className="ml-auto"
          onClick={() => setUnreadOnly(!unreadOnly)}
        >
          {unreadOnly ? 'Showing unread' : 'Unread only'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0 || markAllPending}
        >
          <RiCheckDoubleLine className="size-4" />
          Mark all read
        </Button>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-auto">
        <NotificationsList
          notifications={notifications}
          loading={loading}
          userById={userById}
          now={now}
          onOpenNotification={onOpenNotification}
        />
      </div>

      {canLoadMore ? (
        <div className="mt-3 flex justify-center">
          <Button size="sm" variant="outline" onClick={onLoadMore}>
            Load 50 more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
