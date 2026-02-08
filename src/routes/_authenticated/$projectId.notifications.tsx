import { createFileRoute } from '@tanstack/react-router';

import { DashboardPage } from '@/components/dashboard/dashboard-page';

export const Route = createFileRoute('/_authenticated/$projectId/notifications')({
  head: () => ({
    meta: [
      { title: 'Notifications | Issue → Invoice' },
      { name: 'description', content: 'Review unread and recent activity notifications.' },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { projectId } = Route.useParams();
  return <DashboardPage projectId={projectId} view="notifications" />;
}
