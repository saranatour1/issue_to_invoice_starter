import { ConvexError } from 'convex/values';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import {
  listTimeEntriesArgsSchema,
  listTimeEntriesForIssueArgsSchema,
  startTimerArgsSchema,
  stopTimerArgsSchema,
} from './issueModel';
import { mutation, query } from './_generated/server';

const zQuery = zCustomQuery(query, NoOp);
const zMutation = zCustomMutation(mutation, NoOp);

async function requireViewerId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError('Not authenticated');
  }
  return identity.subject;
}

async function enrichTimeEntry(
  ctx: { db: { get: (id: any) => Promise<any> } },
  entry: any,
) {
  const [issue, project] = await Promise.all([
    entry.issueId ? ctx.db.get(entry.issueId) : Promise.resolve(null),
    entry.projectId ? ctx.db.get(entry.projectId) : Promise.resolve(null),
  ]);

  return {
    ...entry,
    issueTitle: issue?.title ?? null,
    projectName: project?.name ?? null,
  };
}

export const getActiveForViewer = zQuery({
  args: {},
  handler: async (ctx) => {
    const viewerId = await requireViewerId(ctx);

    const active = await ctx.db
      .query('timeEntries')
      .withIndex('by_user_ended', (q) => q.eq('userId', viewerId).eq('endedAt', null))
      .take(1);

    const entry = active[0] ?? null;
    if (!entry) return null;
    return await enrichTimeEntry(ctx, entry);
  },
});

export const startTimer = zMutation({
  args: startTimerArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const issue = args.issueId ? await ctx.db.get(args.issueId) : null;
    if (args.issueId && !issue) {
      throw new ConvexError('Issue not found');
    }

    const projectId = args.projectId ?? issue?.projectId ?? null;
    const project = projectId ? await ctx.db.get(projectId) : null;
    if (projectId && !project) {
      throw new ConvexError('Project not found');
    }

    // Stop any existing active timers.
    const active = await ctx.db
      .query('timeEntries')
      .withIndex('by_user_ended', (q) => q.eq('userId', viewerId).eq('endedAt', null))
      .collect();

    for (const entry of active) {
      await ctx.db.patch(entry._id, { endedAt: now });
    }

    const timeEntryId = await ctx.db.insert('timeEntries', {
      userId: viewerId,
      issueId: args.issueId ?? null,
      projectId,
      description: args.description?.trim() ?? null,
      startedAt: now,
      endedAt: null,
    });

    if (args.issueId) {
      await ctx.db.patch(args.issueId, { lastActivityAt: now });
    }
    if (projectId) {
      await ctx.db.patch(projectId, { lastActivityAt: now });
    }

    return timeEntryId;
  },
});

export const stopTimer = zMutation({
  args: stopTimerArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    if (args.timeEntryId) {
      const entry = await ctx.db.get(args.timeEntryId);
      if (!entry) {
        throw new ConvexError('Time entry not found');
      }
      if (entry.userId !== viewerId) {
        throw new ConvexError('Not authorized');
      }
      if (entry.endedAt !== null) {
        return null;
      }
      await ctx.db.patch(entry._id, { endedAt: now });
      return entry._id;
    }

    const active = await ctx.db
      .query('timeEntries')
      .withIndex('by_user_ended', (q) => q.eq('userId', viewerId).eq('endedAt', null))
      .take(1);

    const entry = active[0] ?? null;
    if (!entry) return null;

    await ctx.db.patch(entry._id, { endedAt: now });
    return entry._id;
  },
});

export const listForViewer = zQuery({
  args: listTimeEntriesArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const limit = args.limit ?? 50;

    const entries = await ctx.db
      .query('timeEntries')
      .withIndex('by_user_started', (q) => q.eq('userId', viewerId))
      .order('desc')
      .take(limit);

    return await Promise.all(entries.map((e) => enrichTimeEntry(ctx, e)));
  },
});

export const listForIssueForViewer = zQuery({
  args: listTimeEntriesForIssueArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const limit = args.limit ?? 50;

    const entries = await ctx.db
      .query('timeEntries')
      .withIndex('by_issue_user_started', (q) => q.eq('issueId', args.issueId).eq('userId', viewerId))
      .order('desc')
      .take(limit);

    return await Promise.all(entries.map((e) => enrichTimeEntry(ctx, e)));
  },
});

