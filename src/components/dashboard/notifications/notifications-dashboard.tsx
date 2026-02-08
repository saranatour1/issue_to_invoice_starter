import { useNavigate } from '@tanstack/react-router';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import { NotificationsPage } from './notifications-page';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import type { MinimalUser } from '@/components/dashboard/issues/types';
import { useNow } from '@/hooks/use-now';

export function NotificationsDashboard({ projectId, viewerId }: { projectId: string; viewerId: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = useNow(30_000);

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(50);

  const selectedProjectId: Id<'projects'> | undefined = projectId === 'all' ? undefined : (projectId as Id<'projects'>);
  useEffect(() => {
    setLimit(50);
  }, [selectedProjectId, unreadOnly]);

  const listArgs = useMemo(
    () => ({
      projectId: selectedProjectId,
      unreadOnly: unreadOnly || undefined,
      limit,
    }),
    [limit, selectedProjectId, unreadOnly],
  );

  const notifications = useQuery(convexQuery(api.notifications.listForViewer, viewerId ? listArgs : 'skip'));
  const unreadNotifications = useQuery(
    convexQuery(
      api.notifications.listForViewer,
      viewerId
        ? {
            projectId: selectedProjectId,
            unreadOnly: true,
            limit: 200,
          }
        : 'skip',
    ),
  );

  const notificationUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const notification of notifications.data ?? []) {
      if (notification.actorId) ids.add(notification.actorId);
    }
    return Array.from(ids);
  }, [notifications.data]);

  const notificationUsers = useQuery(
    convexQuery(api.users.listByUserIds, notificationUserIds.length ? { userIds: notificationUserIds } : 'skip'),
  );

  const userById = useMemo(() => {
    const map = new Map<string, MinimalUser>();
    for (const user of notificationUsers.data ?? []) {
      map.set(user.userId, { name: user.name, email: user.email, pictureUrl: user.pictureUrl });
    }
    return map;
  }, [notificationUsers.data]);

  const markReadFn = useConvexMutation(api.notifications.markRead);
  const markAllReadFn = useConvexMutation(api.notifications.markAllRead);

  const markRead = useMutation({
    mutationFn: (args: { notificationId: Id<'notifications'> }) => markReadFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllReadFn({ projectId: selectedProjectId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const openNotification = async (notification: Doc<'notifications'>) => {
    if (notification.readAt === null) {
      try {
        await markRead.mutateAsync({ notificationId: notification._id });
      } catch {
        // Keep navigation usable even if the read mutation fails transiently.
      }
    }

    if (!notification.issueId) return;
    const targetProjectId = notification.projectId ? (notification.projectId as unknown as string) : 'all';
    navigate({
      to: '/$projectId/issues/$issueId',
      params: {
        projectId: targetProjectId,
        issueId: notification.issueId as unknown as string,
      },
    });
  };

  const rows = notifications.data ?? [];
  const unreadCount = unreadNotifications.data?.length ?? 0;
  const canLoadMore = rows.length >= limit;

  return (
    <NotificationsPage
      notifications={rows}
      loading={notifications.isLoading}
      now={now}
      userById={userById}
      unreadOnly={unreadOnly}
      setUnreadOnly={setUnreadOnly}
      unreadCount={unreadCount}
      markAllPending={markAllRead.isPending}
      onMarkAllRead={() => markAllRead.mutate()}
      canLoadMore={canLoadMore}
      onLoadMore={() => setLimit((prev) => prev + 50)}
      onOpenNotification={(notification) => {
        void openNotification(notification);
      }}
    />
  );
}
