import { Link, createFileRoute } from '@tanstack/react-router';
import {
  RiBankCardLine,
  RiDatabase2Line,
  RiFileTextLine,
  RiFolderOpenLine,
  RiGithubLine,
  RiLayoutLine,
  RiMailSendLine,
  RiSaveLine,
  RiSearchLine,
  RiShieldKeyholeLine,
  RiShieldLine,
  RiTailwindCssLine,
} from '@remixicon/react';
import type { ComponentType } from 'react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SITE_NAME, absoluteUrl, createSeoMeta, getPublicSiteUrl } from '@/lib/seo';

export const Route = createFileRoute('/')({
  head: ({ match }) => {
    const title = 'From issue to invoice';
    const description =
      'Unify GitHub, Linear, and in-app requests. Estimate work, track time, and invoice clients—without spreadsheets.';
    const siteUrl = getPublicSiteUrl();
    const pageUrl = absoluteUrl(match.pathname);

    const jsonLdWebSite = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      ...(siteUrl ? { url: siteUrl } : {}),
      ...(pageUrl ? { '@id': `${pageUrl}#website` } : {}),
      description,
      inLanguage: 'en',
    };

    const jsonLdSoftwareApp = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      ...(siteUrl ? { url: siteUrl } : {}),
      ...(pageUrl ? { '@id': `${pageUrl}#software` } : {}),
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description,
    };

    const jsonLdFaqPage = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      ...(pageUrl ? { '@id': `${pageUrl}#faq` } : {}),
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    };

    const seo = createSeoMeta({
      title: `${title} | ${SITE_NAME}`,
      description,
      pathname: match.pathname,
      ogImagePath: '/convex.svg',
    });

    return {
      meta: seo.meta,
      scripts: [
        { type: 'application/ld+json', children: JSON.stringify(jsonLdWebSite) },
        { type: 'application/ld+json', children: JSON.stringify(jsonLdSoftwareApp) },
        { type: 'application/ld+json', children: JSON.stringify(jsonLdFaqPage) },
      ],
    };
  },
  component: LandingPage,
});

type Feature = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const features: Array<Feature> = [
  {
    title: 'One inbox for all requests',
    description:
      'Pull in GitHub issues, Linear tickets, and in-app requests so nothing falls through the cracks.',
    icon: RiFolderOpenLine,
  },
  {
    title: 'Estimates you can invoice from',
    description:
      'Add time estimates at intake and refine them as you go. Keep scope, time, and cost aligned per client.',
    icon: RiSaveLine,
  },
  {
    title: 'Fast search across sources',
    description:
      'Find work by client, project, label, or issue key—without switching between tools.',
    icon: RiSearchLine,
  },
  {
    title: 'Client-ready invoices',
    description:
      'Turn tracked time into clean invoices with line items that map back to the work that was done.',
    icon: RiFileTextLine,
  },
  {
    title: 'Billing built for teams',
    description:
      'Split work across clients, set rates, and keep your team’s time tracked against the right accounts.',
    icon: RiBankCardLine,
  },
  {
    title: 'Permissions & audit trails',
    description:
      'Keep sensitive client billing secure with clear access controls and an audit-friendly activity log.',
    icon: RiShieldLine,
  },
];

type Technology = {
  name: string;
  description: string;
  status: 'In use' | 'Planned';
  icon: ComponentType<{ className?: string }>;
};

const technologies: Array<Technology> = [
  {
    name: 'Convex',
    description: 'Backend for realtime data, queries, and server logic—built for product teams.',
    status: 'In use',
    icon: RiDatabase2Line,
  },
  {
    name: 'WorkOS AuthKit',
    description: 'Authentication that supports SSO-ready teams with secure sessions and redirects.',
    status: 'In use',
    icon: RiShieldKeyholeLine,
  },
  {
    name: 'Tailwind CSS',
    description: 'Utility-first styling for fast iteration, consistent spacing, and clean UI.',
    status: 'In use',
    icon: RiTailwindCssLine,
  },
  {
    name: 'shadcn/ui',
    description: 'Composable UI components (built on Base UI) with a modern, accessible baseline.',
    status: 'In use',
    icon: RiLayoutLine,
  },
  {
    name: 'GitHub integration',
    description: 'Sync issues, labels, and links back to PRs so work and billing stay connected.',
    status: 'Planned',
    icon: RiGithubLine,
  },
  {
    name: 'Resend',
    description: 'Send invoices and client updates by email without building a mail pipeline from scratch.',
    status: 'Planned',
    icon: RiMailSendLine,
  },
];

type Faq = {
  question: string;
  answer: string;
};

const faqs: Array<Faq> = [
  {
    question: 'Do I need to move everything out of GitHub or Linear?',
    answer:
      'No. The goal is to keep your existing workflows and add a billing-friendly layer that ties work to clients.',
  },
  {
    question: 'Can I invoice multiple clients in the same week?',
    answer:
      'Yes. Track time against the right client/project and generate separate invoices without manual sorting.',
  },
  {
    question: 'How do estimates work?',
    answer:
      'Add an estimate when the request comes in, then refine it as scope changes. Estimates stay linked to the invoice line item.',
  },
  {
    question: 'Is it secure?',
    answer:
      'The app is designed for multi-client workflows, with clear access boundaries and audit-friendly activity tracking.',
  },
];

function LandingPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(70rem_50rem_at_50%_-10%,rgba(0,0,0,0.08),transparent_60%)] dark:bg-[radial-gradient(70rem_50rem_at_50%_-10%,rgba(255,255,255,0.07),transparent_60%)]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-primary/10 via-primary/0 to-transparent"
        />

        <Header />

        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-14">
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-6">
              <Badge variant="secondary">For teams buried in tickets</Badge>
              <h1 className="mt-4 text-pretty text-4xl font-semibold tracking-tight sm:text-6xl">
                From issue to invoice, in one flow.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                Bring GitHub issues, Linear tickets, and in-app requests into one place. Add estimates, track time, and
                generate invoices per client—without spreadsheets.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/$projectId/issues"
                  params={{ projectId: 'all' }}
                  className={buttonVariants({ size: 'lg' })}
                >
                  Sign in
                </Link>
                <a
                  href="#features"
                  className={buttonVariants({ variant: 'outline', size: 'lg' })}
                >
                  See features
                </a>
                <span className="text-xs text-muted-foreground">
                  Works great for agencies, consultants, and internal teams.
                </span>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                <Badge variant="outline">GitHub</Badge>
                <Badge variant="outline">Linear</Badge>
                <Badge variant="outline">In-app</Badge>
                <Badge variant="outline">Estimates</Badge>
                <Badge variant="outline">Time tracking</Badge>
                <Badge variant="outline">Invoices</Badge>
              </div>
            </div>

            <div className="lg:col-span-6">
              <Card className="relative overflow-hidden">
                <div
                  aria-hidden
                  className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-primary/10 blur-2xl"
                />
                <CardHeader className="pb-2">
                  <CardTitle>Today’s work, already billable</CardTitle>
                  <CardDescription>
                    A single view of requests, estimates, and the invoice they’ll end up on.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    <PreviewRow
                      source="GitHub"
                      title="Fix SSO callback edge case"
                      meta="Client: Acme • Estimate: 2.5h"
                    />
                    <PreviewRow
                      source="Linear"
                      title="Improve onboarding checklist"
                      meta="Client: Northwind • Estimate: 4h"
                    />
                    <PreviewRow
                      source="In-app"
                      title="Add CSV export to invoices"
                      meta="Client: Acme • Estimate: 1.5h"
                    />
                  </div>

                  <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">Invoice draft</span>
                      <span className="text-muted-foreground">Acme • Feb 2026</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Fix SSO callback edge case</span>
                        <span className="tabular-nums">2.5h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Add CSV export to invoices</span>
                        <span className="tabular-nums">1.5h</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t pt-2 text-foreground">
                        <span className="font-medium">Total</span>
                        <span className="font-medium tabular-nums">4.0h</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeader
          title="Make scope visible. Make billing painless."
          description="A lightweight workflow that connects intake, estimates, time tracking, and invoices."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </section>

      <section id="tech" className="mx-auto max-w-6xl px-4 pb-16">
        <SectionHeader
          title="Modern stack, practical choices"
          description="Built on tools that scale from one project to many clients."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {technologies.map((technology) => (
            <TechnologyCard key={technology.name} technology={technology} />
          ))}
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-4 pb-16">
        <SectionHeader
          title="A simple workflow your team will actually use"
          description="No more copy/pasting between trackers, spreadsheets, and invoice docs."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <StepCard
            step="01"
            title="Collect"
            description="Centralize work from GitHub, Linear, and your app into one queue."
          />
          <StepCard
            step="02"
            title="Estimate & track"
            description="Set an estimate, start a timer, and keep work tied to a client from day one."
          />
          <StepCard
            step="03"
            title="Invoice"
            description="Generate invoices backed by the actual work—down to the issue or ticket."
          />
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl px-4 pb-16">
        <SectionHeader title="FAQ" description="A few quick answers while this is still early." />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {faqs.map((faq) => (
            <FaqCard key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </section>

      <section id="get-started" className="mx-auto max-w-6xl px-4 pb-20">
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle>Ready to stop losing billable work?</CardTitle>
            <CardDescription>
              Start with a landing page today. Add integrations and billing workflows when you’re ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Link
              to="/$projectId/issues"
              params={{ projectId: 'all' }}
              className={buttonVariants({ size: 'lg' })}
            >
              Sign in
            </Link>
            <a
              href="#features"
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              Explore features
            </a>
            <span className="text-xs text-muted-foreground">
              Tip: rename the product + update copy anytime.
            </span>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Issue → Estimate → Invoice</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#tech" className="hover:text-foreground">
              Tech
            </a>
            <a href="#workflow" className="hover:text-foreground">
              Workflow
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
            <Link to="/progress" className="hover:text-foreground">
              Progress
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Header() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5">
      <Link
        to="/"
        className="flex items-center gap-2 text-sm font-semibold tracking-tight"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="text-[0.7rem]">I</span>
        </span>
        Issue → Invoice
      </Link>

      <nav className="hidden items-center gap-6 text-xs text-muted-foreground md:flex">
        <a href="#features" className="hover:text-foreground">
          Features
        </a>
        <a href="#tech" className="hover:text-foreground">
          Tech
        </a>
        <a href="#workflow" className="hover:text-foreground">
          Workflow
        </a>
        <a href="#faq" className="hover:text-foreground">
          FAQ
        </a>
        <Link to="/progress" className="hover:text-foreground">
          Progress
        </Link>
      </nav>

      <div className="flex items-center gap-2">
        <Link
          to="/$projectId/issues"
          params={{ projectId: 'all' }}
          className={buttonVariants({ variant: 'ghost' })}
        >
          Sign in
        </Link>
        <a href="#get-started" className={buttonVariants({ size: 'lg' })}>
          Get started
        </a>
      </div>
    </header>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <h2 className="text-pretty text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <CardTitle>{feature.title}</CardTitle>
        </div>
        <CardDescription>{feature.description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function TechnologyCard({ technology }: { technology: Technology }) {
  const Icon = technology.icon;
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <CardTitle>{technology.name}</CardTitle>
          </div>
          <Badge variant={technology.status === 'In use' ? 'secondary' : 'outline'}>{technology.status}</Badge>
        </div>
        <CardDescription>{technology.description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <Badge variant="secondary" className="mb-2">
          {step}
        </Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function FaqCard({ question, answer }: { question: string; answer: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className={cn('text-sm')}>{question}</CardTitle>
        <CardDescription>{answer}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function PreviewRow({ source, title, meta }: { source: string; title: string; meta: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background/60 p-3">
      <Badge variant="outline" className="mt-0.5">
        {source}
      </Badge>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{title}</p>
        <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}
