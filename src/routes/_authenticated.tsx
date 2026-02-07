import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth, getSignInUrl } from '@workos/authkit-tanstack-react-start';

export const Route = createFileRoute('/_authenticated')({
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex,nofollow,noarchive' },
      { name: 'googlebot', content: 'noindex,nofollow,noarchive' },
    ],
  }),
  loader: async ({ location }) => {
    const { user } = await getAuth();
    if (!user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: { returnPathname: path } });
      throw redirect({ href });
    }
  },
  component: () => <Outlet />,
});
