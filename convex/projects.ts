import { ConvexError } from 'convex/values';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import { createProjectArgsSchema, getProjectArgsSchema, listProjectsArgsSchema } from './issueModel';
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

export const createProject = zMutation({
  args: createProjectArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const id = await ctx.db.insert('projects', {
      name: args.name.trim(),
      description: args.description?.trim() ?? null,
      color: args.color?.trim() ?? null,
      creatorId: viewerId,
      memberIds: [viewerId],
      archivedAt: null,
      lastActivityAt: now,
    });

    return id;
  },
});

export const listProjects = zQuery({
  args: listProjectsArgsSchema,
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const includeArchived = args.includeArchived ?? false;

    const items = await ctx.db.query('projects').withIndex('by_last_activity').order('desc').take(limit);
    return includeArchived ? items : items.filter((p) => p.archivedAt === null);
  },
});

export const getProject = zQuery({
  args: getProjectArgsSchema,
  handler: async (ctx, args) => {
    return await ctx.db.get('projects', args.projectId);
  },
});
