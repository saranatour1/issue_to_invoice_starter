import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/$projectId/$view/$issueId')({
  loader: ({ params }) => {
    if (params.view === 'invoices') {
      throw redirect({
        to: '/$projectId/$view',
        params: { projectId: params.projectId, view: 'invoices' },
      });
    }
  },
  component: () => null,
});
