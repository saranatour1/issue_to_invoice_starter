import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { createServerFn } from '@tanstack/react-start';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import appCssUrl from '../app.css?url';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ConvexReactClient } from 'convex/react';
import type { ConvexQueryClient } from '@convex-dev/react-query';

import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, absoluteUrl, createSeoMeta } from '@/lib/seo';

const fetchWorkosAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const auth = await getAuth();
  const { user } = auth;

  return {
    userId: user?.id ?? null,
    token: user ? auth.accessToken : null,
  };
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: ({ match }: any) => {
    const canonicalUrl = absoluteUrl(match.pathname as string);
    const seo = createSeoMeta({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      pathname: match.pathname as string,
      ogImagePath: '/convex.svg',
    });

    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'robots', content: 'index,follow,max-image-preview:large' },
        { name: 'googlebot', content: 'index,follow,max-image-preview:large' },
        ...seo.meta,
      ],
      links: [
        { rel: 'stylesheet', href: appCssUrl },
        { rel: 'icon', href: '/convex.svg' },
        ...(canonicalUrl ? [{ rel: 'canonical', href: canonicalUrl }] : []),
      ],
    };
  },
  component: RootComponent,
  notFoundComponent: () => <div>Not Found</div>,
  beforeLoad: async (ctx) => {
    const { userId, token } = await fetchWorkosAuth();

    // During SSR only (the only time serverHttpClient exists),
    // set the WorkOS auth token to make HTTP queries with.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }

    return { userId, token };
  },
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {import.meta.env.DEV ? <TanStackDevtools /> : null}
        <Scripts />
      </body>
    </html>
  );
}
