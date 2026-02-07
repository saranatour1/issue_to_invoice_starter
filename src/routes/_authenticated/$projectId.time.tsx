import { createFileRoute, useParams } from '@tanstack/react-router';

import { DashboardPage } from '@/components/dashboard/dashboard-page';

export const Route = createFileRoute('/_authenticated/$projectId/time')({
  head: () => ({
    meta: [
      { title: 'Time tracking | Issue → Invoice' },
      { name: 'description', content: 'Track time entries and tie work back to issues and projects.' },
    ],
  }),
  component: TimePage,
});

function TimePage() {
  const { projectId } = Route.useParams();
  const issueParams = useParams({
    from: '/_authenticated/$projectId/time/$issueId',
    shouldThrow: false,
  });
  const issueIdParam = (issueParams as { issueId?: string } | undefined)?.issueId ?? null;

  return <DashboardPage projectId={projectId} view="time" issueIdParam={issueIdParam} />;
}
