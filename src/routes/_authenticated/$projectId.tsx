import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/$projectId')({
  loader: ({ location, params }) => {
    if (location.pathname === `/${params.projectId}`) {
      throw redirect({
        to: '/$projectId/$view',
        params: { projectId: params.projectId, view: 'issues' },
      });
    }
  },
  component: () => <Outlet />,
});

