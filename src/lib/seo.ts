export const SITE_NAME = 'Issue → Invoice';

export const DEFAULT_TITLE = SITE_NAME;
export const DEFAULT_DESCRIPTION =
  'Unify GitHub, Linear, and in-app requests. Estimate work, track time, and invoice clients—without spreadsheets.';

export function getPublicSiteUrl(): string | null {
  const raw = (import.meta as any).env.VITE_PUBLIC_SITE_URL as string | undefined;
  if (!raw) return null;

  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/$/, '');
  }
}

export function absoluteUrl(pathOrUrl: string): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;

  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) return null;
  return new URL(pathOrUrl, siteUrl).toString();
}

export function createSeoMeta(args: {
  title: string;
  description: string;
  pathname?: string;
  ogImagePath?: string;
}) {
  const url = args.pathname ? absoluteUrl(args.pathname) : null;
  const ogImagePath = args.ogImagePath ?? '/convex.svg';
  const ogImageUrl = absoluteUrl(ogImagePath) ?? ogImagePath;

  const meta = [
    { title: args.title },
    { name: 'description', content: args.description },
    { name: 'application-name', content: SITE_NAME },
    { name: 'referrer', content: 'strict-origin-when-cross-origin' },
    { name: 'color-scheme', content: 'light dark' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:title', content: args.title },
    { property: 'og:description', content: args.description },
    { property: 'og:type', content: 'website' },
    ...(url ? [{ property: 'og:url', content: url }] : []),
    { property: 'og:image', content: ogImageUrl },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: args.title },
    { name: 'twitter:description', content: args.description },
    { name: 'twitter:image', content: ogImageUrl },
  ];

  return { meta };
}

