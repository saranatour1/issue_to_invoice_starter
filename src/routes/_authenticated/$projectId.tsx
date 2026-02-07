import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { convexQuery } from '@convex-dev/react-query';

import { api } from '../../../convex/_generated/api';

export const Route = createFileRoute('/_authenticated/$projectId')({
  loader: async ({ location, params, context }) => {
    if (location.pathname === `/${params.projectId}`) {
      const viewerSettings = await context.queryClient
        .ensureQueryData(convexQuery(api.users.getViewerSettings, {}))
        .catch(() => null);
      const defaultView = viewerSettings?.defaultDashboardView ?? 'issues';
      const to =
        defaultView === 'time'
          ? '/$projectId/time'
          : defaultView === 'invoices'
            ? '/$projectId/invoices'
            : defaultView === 'settings'
              ? '/$projectId/settings'
              : '/$projectId/issues';
      throw redirect({
        to,
        params: { projectId: params.projectId },
      });
    }
  },
  component: () => <Outlet />,
});
