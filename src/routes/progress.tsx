import { Link, createFileRoute } from '@tanstack/react-router';

import progressLog from '../../progress.md?raw';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SITE_NAME, createSeoMeta } from '@/lib/seo';

export const Route = createFileRoute('/progress')({
  head: ({ match }) => {
    const title = `Product progress | ${SITE_NAME}`;
    const description = 'Public changelog feed sourced directly from progress.md in the app repository.';
    const seo = createSeoMeta({
      title,
      description,
      pathname: match.pathname,
      ogImagePath: '/convex.svg',
    });
    return { meta: seo.meta };
  },
  component: ProgressPage,
});

function ProgressPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground">
      <div className="mx-auto grid w-full max-w-4xl gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Product progress</h1>
            <p className="text-xs text-muted-foreground">Shared from `progress.md` so stakeholders can follow updates.</p>
          </div>
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            Back to home
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Latest updates</CardTitle>
            <CardDescription>Auto-reflects repository progress notes.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[70dvh] overflow-auto rounded-md border border-border/60 bg-muted/20 p-4 text-[0.7rem] leading-relaxed">
              {progressLog}
            </pre>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
