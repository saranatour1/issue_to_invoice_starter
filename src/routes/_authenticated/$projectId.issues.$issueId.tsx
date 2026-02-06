import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/$projectId/issues/$issueId')({
  component: () => null,
});

