import * as z from 'zod/v4';
import { ConvexError } from 'convex/values';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import { getUserByUserIdArgsSchema, listUsersByUserIdsArgsSchema } from './issueModel';
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
      email: identity.email ?? null,
      pictureUrl: identity.pictureUrl ?? null,
      lastSeenAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
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

