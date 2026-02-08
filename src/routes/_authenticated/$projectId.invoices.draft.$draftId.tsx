import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/$projectId/invoices/draft/$draftId')({
  component: () => null,
});

