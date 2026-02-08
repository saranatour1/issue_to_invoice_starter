import { RateLimiter } from '@convex-dev/rate-limiter';
import { ConvexError } from 'convex/values';

import { components } from './_generated/api';
import type { MutationCtx } from './_generated/server';
import type { PlanTier } from './issueModel';

type QuotaAction = 'projects' | 'issues' | 'invoices';

const NO_RESET_PERIOD_MS = 1000 * 60 * 60 * 24 * 365 * 100;
const NO_RESET_WINDOW_START_MS = 0;

const FREE_PLAN_LIMITS: Record<QuotaAction, number> = {
  projects: 5,
  issues: 250,
  invoices: 250,
};

// Pro limits are intentionally isolated here so a billing webhook can replace
// them with dynamic entitlements later without touching call sites.
const PRO_PLAN_LIMITS: Record<QuotaAction, number> = {
  projects: 250,
  issues: 25_000,
  invoices: 25_000,
};

const creationLimiter = new RateLimiter((components as { rateLimiter: never }).rateLimiter);

function isPlanTier(value: unknown): value is PlanTier {
  return value === 'free' || value === 'pro';
}

export function creationLimitsForPlan(planTier: PlanTier) {
  return planTier === 'pro' ? PRO_PLAN_LIMITS : FREE_PLAN_LIMITS;
}

function actionLabel(action: QuotaAction) {
  if (action === 'projects') return 'projects';
  if (action === 'issues') return 'issues';
  return 'invoices';
}

function counterValue(args: {
  action: QuotaAction;
  projectCreateCount: number | undefined;
  issueCreateCount: number | undefined;
  invoiceCreateCount: number | undefined;
}) {
  if (args.action === 'projects') return args.projectCreateCount ?? 0;
  if (args.action === 'issues') return args.issueCreateCount ?? 0;
  return args.invoiceCreateCount ?? 0;
}

function quotaMessage(args: { action: QuotaAction; planTier: PlanTier; limit: number }) {
  if (args.planTier === 'pro') {
    return `Pro account limit reached for ${actionLabel(args.action)} (${args.limit} lifetime).`;
  }
  return `Free account limit reached for ${actionLabel(args.action)} (${args.limit} lifetime). Upgrade to pro to increase this cap.`;
}

export async function enforceCreationQuota(ctx: MutationCtx, args: { viewerId: string; action: QuotaAction }) {
  let viewer = await ctx.db
    .query('users')
    .withIndex('by_userId', (q) => q.eq('userId', args.viewerId))
    .unique();

  if (!viewer) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.viewerId) {
      throw new ConvexError('User profile not initialized. Refresh and try again.');
    }

    const userId = await ctx.db.insert('users', {
      userId: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      issuer: identity.issuer,
      name: identity.name ?? null,
      email: identity.email?.trim().toLowerCase() ?? null,
      pictureUrl: identity.pictureUrl ?? null,
      lastSeenAt: Date.now(),
      planTier: 'free',
      projectCreateCount: 0,
      issueCreateCount: 0,
      invoiceCreateCount: 0,
    });
    viewer = await ctx.db.get('users', userId);
    if (!viewer) {
      throw new ConvexError('Could not initialize user profile.');
    }
  }

  const planTier: PlanTier = isPlanTier(viewer.planTier) ? viewer.planTier : 'free';
  const limits = creationLimitsForPlan(planTier);
  const limit = limits[args.action];
  const used = counterValue({
    action: args.action,
    projectCreateCount: viewer.projectCreateCount,
    issueCreateCount: viewer.issueCreateCount,
    invoiceCreateCount: viewer.invoiceCreateCount,
  });

  if (used >= limit) {
    throw new ConvexError(quotaMessage({ action: args.action, planTier, limit }));
  }

  const status = await creationLimiter.limit(ctx, `create_${args.action}`, {
    key: `${args.viewerId}:${planTier}`,
    config: {
      kind: 'fixed window',
      rate: limit,
      capacity: limit,
      period: NO_RESET_PERIOD_MS,
      start: NO_RESET_WINDOW_START_MS,
    },
  });

  if (!status.ok) {
    throw new ConvexError(quotaMessage({ action: args.action, planTier, limit }));
  }

  if (args.action === 'projects') {
    await ctx.db.patch('users', viewer._id, {
      planTier,
      projectCreateCount: used + 1,
    });
    return;
  }

  if (args.action === 'issues') {
    await ctx.db.patch('users', viewer._id, {
      planTier,
      issueCreateCount: used + 1,
    });
    return;
  }

  await ctx.db.patch('users', viewer._id, {
    planTier,
    invoiceCreateCount: used + 1,
  });
}
