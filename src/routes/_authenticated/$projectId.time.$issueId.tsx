import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/$projectId/time/$issueId')({
  component: () => null,
});

