import { ConvexError } from 'convex/values';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import {
  addProjectMemberArgsSchema,
  createProjectArgsSchema,
  getProjectArgsSchema,
  listProjectsArgsSchema,
  removeProjectMemberArgsSchema,
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

function canManageProject(project: { creatorId: string; memberIds: Array<string> }, viewerId: string) {
  return project.creatorId === viewerId || project.memberIds.includes(viewerId);
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

export const addMember = zMutation({
  args: addProjectMemberArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const project = await ctx.db.get('projects', args.projectId);
    if (!project) {
      throw new ConvexError('Project not found');
    }
    if (!canManageProject(project, viewerId)) {
      throw new ConvexError('Not authorized to manage this project');
    }

    const identifier = args.identifier.trim();
    if (!identifier) {
      throw new ConvexError('Member identifier is required');
    }

    let member = await ctx.db.query('users').withIndex('by_userId', (q) => q.eq('userId', identifier)).unique();
    if (!member) {
      member = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', identifier.toLowerCase()))
        .unique();
    }

    if (!member) {
      throw new ConvexError('No user found for that email or user ID');
    }

    if (project.memberIds.includes(member.userId)) {
      return { added: false, userId: member.userId };
    }

    await ctx.db.patch('projects', args.projectId, {
      memberIds: [...project.memberIds, member.userId],
      lastActivityAt: now,
    });

    return { added: true, userId: member.userId };
  },
});

export const removeMember = zMutation({
  args: removeProjectMemberArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const project = await ctx.db.get('projects', args.projectId);
    if (!project) {
      throw new ConvexError('Project not found');
    }
    if (!canManageProject(project, viewerId)) {
      throw new ConvexError('Not authorized to manage this project');
    }
    if (project.creatorId === args.userId) {
      throw new ConvexError('Project owner cannot be removed');
    }
    if (!project.memberIds.includes(args.userId)) {
      return { removed: false };
    }

    await ctx.db.patch('projects', args.projectId, {
      memberIds: project.memberIds.filter((memberId) => memberId !== args.userId),
      lastActivityAt: now,
    });

    return { removed: true };
  },
});
