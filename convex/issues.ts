import { ConvexError } from 'convex/values';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import {
  IssueStatusSchema,
  addIssueCommentArgsSchema,
  createIssueArgsSchema,
  listIssuesArgsSchema,
  setIssueAssigneesArgsSchema,
  toggleReactionArgsSchema,
} from './issueModel';
import { mutation, query } from './_generated/server';

const zQuery = zCustomQuery(query, NoOp);
const zMutation = zCustomMutation(mutation, NoOp);

function truncateForNotification(text: string, maxLength = 140) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

async function requireViewerId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError('Not authenticated');
  }
  return identity.subject;
}

async function createNotification(
  ctx: {
    db: {
      insert: (
        tableName: 'notifications',
        value: {
          userId: string;
          actorId: string | null;
          type:
            | 'comment_added'
            | 'comment_replied'
            | 'reaction_added'
            | 'issue_created'
            | 'issue_status_changed'
            | 'issue_assigned';
          issueId: any;
          commentId: any;
          title: string;
          body: string | null;
          readAt: null;
        },
      ) => Promise<any>;
    };
  },
  args: {
    userId: string;
    actorId: string | null;
    type:
      | 'comment_added'
      | 'comment_replied'
      | 'reaction_added'
      | 'issue_created'
      | 'issue_status_changed'
      | 'issue_assigned';
    issueId: any;
    commentId: any;
    title: string;
    body?: string | null;
  },
) {
  await ctx.db.insert('notifications', {
    userId: args.userId,
    actorId: args.actorId,
    type: args.type,
    issueId: args.issueId,
    commentId: args.commentId,
    title: args.title,
    body: args.body ?? null,
    readAt: null,
  });
}

export const createIssue = zMutation({
  args: createIssueArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const issueId = await ctx.db.insert('issues', {
      source: 'app',
      externalId: null,
      title: args.title.trim(),
      description: args.description?.trim() ?? null,
      status: 'open',
      priority: args.priority ?? 'medium',
      estimateMinutes: args.estimateMinutes ?? null,
      creatorId: viewerId,
      assigneeIds: [],
      archivedAt: null,
      lastActivityAt: now,
    });

    return issueId;
  },
});

export const listIssues = zQuery({
  args: listIssuesArgsSchema,
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const includeArchived = args.includeArchived ?? false;

    if (args.status) {
      const status = args.status;
      const items = await ctx.db
        .query('issues')
        .withIndex('by_status', (q) => q.eq('status', status))
        .order('desc')
        .take(limit);
      return includeArchived ? items : items.filter((i) => i.archivedAt === null);
    }

    const items = await ctx.db.query('issues').withIndex('by_last_activity').order('desc').take(limit);
    return includeArchived ? items : items.filter((i) => i.archivedAt === null);
  },
});

export const getIssue = zQuery({
  args: {
    issueId: addIssueCommentArgsSchema.shape.issueId,
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.issueId);
  },
});

export const addIssueComment = zMutation({
  args: addIssueCommentArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();
    const parentCommentId = args.parentCommentId ?? null;

    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError('Issue not found');
    }

    if (parentCommentId) {
      const parent = await ctx.db.get(parentCommentId);
      if (!parent || parent.issueId !== args.issueId) {
        throw new ConvexError('Parent comment not found for this issue');
      }
    }

    const commentId = await ctx.db.insert('issueComments', {
      issueId: args.issueId,
      parentCommentId,
      authorId: viewerId,
      body: args.body.trim(),
      editedAt: null,
      deletedAt: null,
    });

    await ctx.db.patch(args.issueId, { lastActivityAt: now });

    // Notifications
    const recipients = new Set<string>();

    if (issue.creatorId !== viewerId) {
      recipients.add(issue.creatorId);
    }

    if (parentCommentId) {
      const parent = await ctx.db.get(parentCommentId);
      if (parent && parent.authorId !== viewerId) {
        recipients.add(parent.authorId);
      }
    }

    for (const userId of recipients) {
      await createNotification(ctx, {
        userId,
        actorId: viewerId,
        type: parentCommentId ? 'comment_replied' : 'comment_added',
        issueId: args.issueId,
        commentId,
        title: parentCommentId ? 'New reply' : 'New comment',
        body: truncateForNotification(args.body),
      });
    }

    return commentId;
  },
});

export const listIssueComments = zQuery({
  args: {
    issueId: addIssueCommentArgsSchema.shape.issueId,
    parentCommentId: addIssueCommentArgsSchema.shape.parentCommentId,
    limit: listIssuesArgsSchema.shape.limit,
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const parentCommentId = args.parentCommentId ?? null;

    return await ctx.db
      .query('issueComments')
      .withIndex('by_issue_parent', (q) => q.eq('issueId', args.issueId).eq('parentCommentId', parentCommentId))
      .order('asc')
      .take(limit);
  },
});

export const setIssueStatus = zMutation({
  args: {
    issueId: addIssueCommentArgsSchema.shape.issueId,
    status: IssueStatusSchema,
  },
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError('Issue not found');
    }

    await ctx.db.patch(args.issueId, { status: args.status, lastActivityAt: now });

    if (issue.creatorId !== viewerId) {
      await createNotification(ctx, {
        userId: issue.creatorId,
        actorId: viewerId,
        type: 'issue_status_changed',
        issueId: args.issueId,
        commentId: null,
        title: 'Issue status updated',
        body: `Status set to ${args.status.replace('_', ' ')}`,
      });
    }

    return null;
  },
});

export const setIssueAssignees = zMutation({
  args: setIssueAssigneesArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError('Issue not found');
    }

    const nextAssigneeIds = Array.from(
      new Set(
        args.assigneeIds
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    );

    const prevAssigneeIds = issue.assigneeIds ?? [];
    const prev = new Set(prevAssigneeIds);
    const added = nextAssigneeIds.filter((id) => !prev.has(id));

    await ctx.db.patch(args.issueId, { assigneeIds: nextAssigneeIds, lastActivityAt: now });

    for (const userId of added) {
      if (userId === viewerId) continue;
      await createNotification(ctx, {
        userId,
        actorId: viewerId,
        type: 'issue_assigned',
        issueId: args.issueId,
        commentId: null,
        title: 'Assigned to an issue',
        body: issue.title,
      });
    }

    return null;
  },
});

export const toggleIssueReaction = zMutation({
  args: toggleReactionArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const commentId = args.commentId ?? null;

    if (commentId) {
      const comment = await ctx.db.get(commentId);
      if (!comment || comment.issueId !== args.issueId) {
        throw new ConvexError('Comment not found for this issue');
      }
    }

    const existing = await ctx.db
      .query('issueReactions')
      .withIndex('by_target_user_emoji', (q) =>
        q.eq('issueId', args.issueId).eq('commentId', commentId).eq('userId', viewerId).eq('emoji', args.emoji),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { added: false };
    }

    const reactionId = await ctx.db.insert('issueReactions', {
      issueId: args.issueId,
      commentId,
      userId: viewerId,
      emoji: args.emoji,
    });

    // Notifications
    if (commentId) {
      const comment = await ctx.db.get(commentId);
      if (comment && comment.authorId !== viewerId) {
        await createNotification(ctx, {
          userId: comment.authorId,
          actorId: viewerId,
          type: 'reaction_added',
          issueId: args.issueId,
          commentId,
          title: 'Reaction on your comment',
          body: args.emoji,
        });
      }
    } else {
      const issue = await ctx.db.get(args.issueId);
      if (issue && issue.creatorId !== viewerId) {
        await createNotification(ctx, {
          userId: issue.creatorId,
          actorId: viewerId,
          type: 'reaction_added',
          issueId: args.issueId,
          commentId: null,
          title: 'Reaction on your issue',
          body: args.emoji,
        });
      }
    }

    return { added: true, reactionId };
  },
});
