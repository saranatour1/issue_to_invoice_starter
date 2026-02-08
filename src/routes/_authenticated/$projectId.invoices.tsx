import { createFileRoute, useParams } from '@tanstack/react-router';

import { DashboardPage } from '@/components/dashboard/dashboard-page';

export const Route = createFileRoute('/_authenticated/$projectId/invoices')({
  head: () => ({
    meta: [
      { title: 'Invoices | Issue → Invoice' },
      { name: 'description', content: 'Generate client-ready invoices from tracked time and issues.' },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const { projectId } = Route.useParams();
  const invoiceParams = useParams({
    from: '/_authenticated/$projectId/invoices/$invoiceId',
    shouldThrow: false,
  });
  const invoiceIdParam = (invoiceParams as { invoiceId?: string } | undefined)?.invoiceId ?? null;

  const draftParams = useParams({
    from: '/_authenticated/$projectId/invoices/draft/$draftId',
    shouldThrow: false,
  });
  const draftIdParam = (draftParams as { draftId?: string } | undefined)?.draftId ?? null;

  return <DashboardPage projectId={projectId} view="invoices" invoiceIdParam={invoiceIdParam} draftIdParam={draftIdParam} />;
}
