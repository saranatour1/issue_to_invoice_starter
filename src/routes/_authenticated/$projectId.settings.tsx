import { createFileRoute } from '@tanstack/react-router';

import { DashboardPage } from '@/components/dashboard/dashboard-page';

export const Route = createFileRoute('/_authenticated/$projectId/settings')({
  head: () => ({
    meta: [
      { title: 'Settings | Issue → Invoice' },
      { name: 'description', content: 'Manage profile defaults, issue view settings, and project members.' },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { projectId } = Route.useParams();
  return <DashboardPage projectId={projectId} view="settings" />;
}
