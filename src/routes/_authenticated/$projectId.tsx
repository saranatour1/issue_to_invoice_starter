import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/$projectId')({
  loader: ({ location, params }) => {
    if (location.pathname === `/${params.projectId}`) {
      throw redirect({
        to: '/$projectId/issues',
        params: { projectId: params.projectId },
      });
    }
  },
  component: () => <Outlet />,
});
