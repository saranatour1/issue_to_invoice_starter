import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/authenticated')({
  loader: ({ location }) => {
    if (location.pathname === '/authenticated') {
      throw redirect({
        to: '/$projectId/$view',
        params: { projectId: 'all', view: 'issues' },
      });
    }
  },
  component: () => <Outlet />,
});
