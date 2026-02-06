import { createFileRoute, useParams } from '@tanstack/react-router';

import { DashboardPage } from '@/components/dashboard/dashboard-page';

export const Route = createFileRoute('/_authenticated/$projectId/issues')({
  component: IssuesPage,
});

function IssuesPage() {
  const { projectId } = Route.useParams();
  const issueParams = useParams({
    from: '/_authenticated/$projectId/issues/$issueId',
    shouldThrow: false,
  });
  const issueIdParam = (issueParams as { issueId?: string } | undefined)?.issueId ?? null;

  return <DashboardPage projectId={projectId} view="issues" issueIdParam={issueIdParam} />;
}

