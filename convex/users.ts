import * as z from 'zod/v4';
import { ConvexError } from 'convex/values';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import { getUserByUserIdArgsSchema, listUsersByUserIdsArgsSchema, updateViewerSettingsArgsSchema } from './issueModel';
import { mutation, query } from './_generated/server';

const zQuery = zCustomQuery(query, NoOp);
const zMutation = zCustomMutation(mutation, NoOp);

async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<any> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError('Not authenticated');
  }
  return identity;
}

function getDisplayName(identity: {
  name?: string;
  givenName?: string;
  familyName?: string;
  preferredUsername?: string;
  nickname?: string;
}) {
  if (identity.name) return identity.name;
  const combined = [identity.givenName, identity.familyName].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  if (identity.preferredUsername) return identity.preferredUsername;
  if (identity.nickname) return identity.nickname;
  return null;
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? null;
}

export const upsertViewer = zMutation({
  args: z.object({}),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query('users')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();

    const patch = {
      userId: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      issuer: identity.issuer,
      name: getDisplayName(identity),
      email: normalizeEmail(identity.email),
      pictureUrl: identity.pictureUrl ?? null,
      lastSeenAt: now,
    };

    if (existing) {
      await ctx.db.patch('users', existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert('users', patch);
  },
});

export const getViewer = zQuery({
  args: z.object({}),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query('users')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();
  },
});

export const getViewerSettings = zQuery({
  args: z.object({}),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const viewer = await ctx.db
      .query('users')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!viewer) return null;

    return {
      preferredName: viewer.preferredName ?? null,
      timezone: viewer.timezone ?? null,
      weeklyDigestEnabled: viewer.weeklyDigestEnabled ?? false,
      defaultDashboardView: viewer.defaultDashboardView ?? 'issues',
      issueLayoutPreference: viewer.issueLayoutPreference ?? 'list',
      issueStatusFilterPreference: viewer.issueStatusFilterPreference ?? 'open',
      issueFavoritesOnlyPreference: viewer.issueFavoritesOnlyPreference ?? false,
    };
  },
});

export const updateViewerSettings = zMutation({
  args: updateViewerSettingsArgsSchema,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query('users')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();

    const basePatch = {
      userId: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      issuer: identity.issuer,
      name: getDisplayName(identity),
      email: normalizeEmail(identity.email),
      pictureUrl: identity.pictureUrl ?? null,
      lastSeenAt: now,
    };

    const settingsPatch: Record<string, unknown> = {};
    if (args.preferredName !== undefined) settingsPatch.preferredName = args.preferredName?.trim() || null;
    if (args.timezone !== undefined) settingsPatch.timezone = args.timezone?.trim() || null;
    if (args.weeklyDigestEnabled !== undefined) settingsPatch.weeklyDigestEnabled = args.weeklyDigestEnabled;
    if (args.defaultDashboardView !== undefined) settingsPatch.defaultDashboardView = args.defaultDashboardView;
    if (args.issueLayoutPreference !== undefined) settingsPatch.issueLayoutPreference = args.issueLayoutPreference;
    if (args.issueStatusFilterPreference !== undefined) {
      settingsPatch.issueStatusFilterPreference = args.issueStatusFilterPreference;
    }
    if (args.issueFavoritesOnlyPreference !== undefined) {
      settingsPatch.issueFavoritesOnlyPreference = args.issueFavoritesOnlyPreference;
    }

    if (existing) {
      await ctx.db.patch('users', existing._id, { ...basePatch, ...settingsPatch });
      return existing._id;
    }

    return await ctx.db.insert('users', { ...basePatch, ...settingsPatch });
  },
});

export const getByUserId = zQuery({
  args: getUserByUserIdArgsSchema,
  handler: async (ctx, args) => {
    return await ctx.db.query('users').withIndex('by_userId', (q) => q.eq('userId', args.userId)).unique();
  },
});

export const listByUserIds = zQuery({
  args: listUsersByUserIdsArgsSchema,
  handler: async (ctx, args) => {
    const uniqueUserIds = Array.from(new Set(args.userIds));

    const users = await Promise.all(
      uniqueUserIds.map((userId) =>
        ctx.db.query('users').withIndex('by_userId', (q) => q.eq('userId', userId)).unique(),
      ),
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});
