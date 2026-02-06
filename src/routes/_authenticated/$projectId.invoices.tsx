import { createFileRoute } from '@tanstack/react-router';

import { DashboardPage } from '@/components/dashboard/dashboard-page';

export const Route = createFileRoute('/_authenticated/$projectId/invoices')({
  component: InvoicesPage,
});

function InvoicesPage() {
  const { projectId } = Route.useParams();
  return <DashboardPage projectId={projectId} view="invoices" />;
}

