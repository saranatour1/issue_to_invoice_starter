import { ConvexError } from 'convex/values';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import {
  IssueStatusSchema,
  addIssueCommentArgsSchema,
  createIssueArgsSchema,
  listFavoriteIssuesArgsSchema,
  listIssuesArgsSchema,
  listIssuesByIdsArgsSchema,
  setIssueAssigneesArgsSchema,
  setIssueLabelsArgsSchema,
  toggleIssueFavoriteArgsSchema,
  toggleIssueLinkArgsSchema,
  toggleReactionArgsSchema,
} from './issueModel';
import { enforceCreationQuota } from './rateLimits';
import { mutation, query } from './_generated/server';
import type { NotificationType } from './issueModel';

const zQuery = zCustomQuery(query, NoOp);
const zMutation = zCustomMutation(mutation, NoOp);

function truncateForNotification(text: string, maxLength = 140) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function normalizeIssueLabels(labels: Array<string>) {
  const cleaned: Array<string> = [];
  const seen = new Set<string>();

  for (const rawLabel of labels) {
    const trimmed = rawLabel.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;
    const label = trimmed.slice(0, 32);
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    cleaned.push(label);
    if (cleaned.length >= 20) break;
  }

  return cleaned;
}

function extractMentionedUserIds(body: string) {
  const ids = new Set<string>();
  const regex = /(^|\s)@([A-Za-z0-9][A-Za-z0-9._:-]{0,127})/g;
  let match = regex.exec(body);
  while (match) {
    const userId = match[2];
    if (userId) ids.add(userId);
    match = regex.exec(body);
  }
  return Array.from(ids);
}

function notificationPriority(type: NotificationType) {
  if (type === 'mentioned') return 3;
  if (type === 'comment_replied') return 2;
  if (type === 'comment_added') return 1;
  return 0;
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
          type: NotificationType;
          projectId: any;
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
    type: NotificationType;
    projectId?: any;
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
    projectId: args.projectId ?? null,
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
    await enforceCreationQuota(ctx, { viewerId, action: 'issues' });
    const now = Date.now();

    const parentIssueId = args.parentIssueId ?? null;
    let projectId = args.projectId ?? null;

    if (parentIssueId) {
      const parent = await ctx.db.get('issues', parentIssueId);
      if (!parent) {
        throw new ConvexError('Parent issue not found');
      }

      if (args.projectId && parent.projectId !== args.projectId) {
        throw new ConvexError('Sub-issue project must match parent issue project');
      }

      projectId = parent.projectId ?? null;

      await ctx.db.patch('issues', parentIssueId, { lastActivityAt: now });
    }

    if (projectId) {
      const project = await ctx.db.get('projects', projectId);
      if (!project) {
        throw new ConvexError('Project not found');
      }
      await ctx.db.patch('projects', projectId, { lastActivityAt: now });
    }

    const issueId = await ctx.db.insert('issues', {
      source: 'app',
      externalId: null,
      projectId,
      parentIssueId,
      title: args.title.trim(),
      description: args.description?.trim() ?? null,
      status: 'open',
      priority: args.priority ?? 'medium',
      estimateMinutes: args.estimateMinutes ?? null,
      labels: normalizeIssueLabels(args.labels ?? []),
      creatorId: viewerId,
      assigneeIds: [],
      blockedByIssueIds: [],
      relatedIssueIds: [],
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
    const parentIssueId = args.parentIssueId ?? null;

    const take = Math.min(200, includeArchived ? limit : limit * 4);

    let items: Array<any>;
    if (parentIssueId !== null) {
      if (args.projectId) {
        const projectId = args.projectId;
        items = await ctx.db
          .query('issues')
          .withIndex('by_project_parent_last_activity', (q) =>
            q.eq('projectId', projectId).eq('parentIssueId', parentIssueId),
          )
          .order('desc')
          .take(take);
      } else if (args.status) {
        const status = args.status;
        items = await ctx.db
          .query('issues')
          .withIndex('by_status_parent_last_activity', (q) =>
            q.eq('status', status).eq('parentIssueId', parentIssueId),
          )
          .order('desc')
          .take(take);
      } else {
        items = await ctx.db
          .query('issues')
          .withIndex('by_parent_last_activity', (q) => q.eq('parentIssueId', parentIssueId))
          .order('desc')
          .take(take);
      }
    } else if (args.projectId) {
      const projectId = args.projectId;
      items = await ctx.db
        .query('issues')
        .withIndex('by_project_last_activity', (q) => q.eq('projectId', projectId))
        .order('desc')
        .take(take);
    } else if (args.status) {
      const status = args.status;
      items = await ctx.db
        .query('issues')
        .withIndex('by_status', (q) => q.eq('status', status))
        .order('desc')
        .take(take);
    } else {
      items = await ctx.db.query('issues').withIndex('by_last_activity').order('desc').take(take);
    }

    if (!includeArchived) {
      items = items.filter((i) => i.archivedAt === null);
    }
    if (args.projectId && args.status) {
      const status = args.status;
      items = items.filter((i) => i.status === status);
    }
    if (parentIssueId === null) {
      items = items.filter((i) => (i.parentIssueId ?? null) === null);
    }

    return items.slice(0, limit);
  },
});

export const listIssuesByIds = zQuery({
  args: listIssuesByIdsArgsSchema,
  handler: async (ctx, args) => {
    const cache = new Map<string, any>();
    const ordered: Array<any> = [];

    for (const issueId of args.issueIds) {
      const key = issueId as unknown as string;
      if (!cache.has(key)) {
        cache.set(key, await ctx.db.get('issues', issueId));
      }
      const issue = cache.get(key);
      if (issue) ordered.push(issue);
    }

    return ordered;
  },
});

export const getIssue = zQuery({
  args: {
    issueId: addIssueCommentArgsSchema.shape.issueId,
  },
  handler: async (ctx, args) => {
    return await ctx.db.get('issues', args.issueId);
  },
});

export const listFavoriteIssueIds = zQuery({
  args: listFavoriteIssuesArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const limit = args.limit ?? 200;

    const favorites = await ctx.db
      .query('issueFavorites')
      .withIndex('by_user_created', (q) => q.eq('userId', viewerId))
      .order('desc')
      .take(limit);

    return favorites.map((f) => f.issueId);
  },
});

export const listFavoriteIssues = zQuery({
  args: listFavoriteIssuesArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const limit = args.limit ?? 50;

    const favorites = await ctx.db
      .query('issueFavorites')
      .withIndex('by_user_created', (q) => q.eq('userId', viewerId))
      .order('desc')
      .take(limit);

    const issues = await Promise.all(favorites.map((f) => ctx.db.get('issues', f.issueId)));
    return issues.filter((i): i is NonNullable<typeof i> => i !== null);
  },
});

export const toggleIssueFavorite = zMutation({
  args: toggleIssueFavoriteArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('Issue not found');
    }

    const existing = await ctx.db
      .query('issueFavorites')
      .withIndex('by_user_issue', (q) => q.eq('userId', viewerId).eq('issueId', args.issueId))
      .unique();

    if (existing) {
      await ctx.db.delete('issueFavorites', existing._id);
      return { added: false };
    }

    const favoriteId = await ctx.db.insert('issueFavorites', {
      issueId: args.issueId,
      userId: viewerId,
      createdAt: now,
    });

    return { added: true, favoriteId };
  },
});

export const toggleIssueLink = zMutation({
  args: toggleIssueLinkArgsSchema,
  handler: async (ctx, args) => {
    await requireViewerId(ctx);
    const now = Date.now();

    if (args.issueId === args.otherIssueId) {
      throw new ConvexError('Cannot link an issue to itself');
    }

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('Issue not found');
    }

    const other = await ctx.db.get('issues', args.otherIssueId);
    if (!other) {
      throw new ConvexError('Other issue not found');
    }

    if (args.type === 'blocked_by') {
      const set = new Set(issue.blockedByIssueIds ?? []);
      const existed = set.has(args.otherIssueId);
      if (existed) {
        set.delete(args.otherIssueId);
      } else {
        set.add(args.otherIssueId);
      }

      await ctx.db.patch('issues', args.issueId, {
        blockedByIssueIds: Array.from(set),
        lastActivityAt: now,
      });

      return { added: !existed };
    }

    const a = new Set(issue.relatedIssueIds ?? []);
    const b = new Set(other.relatedIssueIds ?? []);

    const existed = a.has(args.otherIssueId) || b.has(args.issueId);
    if (existed) {
      a.delete(args.otherIssueId);
      b.delete(args.issueId);
    } else {
      a.add(args.otherIssueId);
      b.add(args.issueId);
    }

    await ctx.db.patch('issues', args.issueId, {
      relatedIssueIds: Array.from(a),
      lastActivityAt: now,
    });

    await ctx.db.patch('issues', args.otherIssueId, {
      relatedIssueIds: Array.from(b),
      lastActivityAt: now,
    });

    return { added: !existed };
  },
});

export const addIssueComment = zMutation({
  args: addIssueCommentArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();
    const parentCommentId = args.parentCommentId ?? null;

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('Issue not found');
    }

    let parentComment: { issueId: typeof args.issueId; authorId: string } | null = null;
    if (parentCommentId) {
      parentComment = await ctx.db.get('issueComments', parentCommentId);
      if (!parentComment || parentComment.issueId !== args.issueId) {
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

    await ctx.db.patch('issues', args.issueId, { lastActivityAt: now });

    // Notifications
    const recipients = new Map<string, { type: NotificationType; title: string }>();
    const setRecipient = (userId: string, next: { type: NotificationType; title: string }) => {
      const existing = recipients.get(userId);
      if (!existing || notificationPriority(next.type) > notificationPriority(existing.type)) {
        recipients.set(userId, next);
      }
    };

    const baseCommentNotification = parentCommentId
      ? ({ type: 'comment_replied', title: 'New reply' } as const)
      : ({ type: 'comment_added', title: 'New comment' } as const);
    if (issue.creatorId !== viewerId) {
      setRecipient(issue.creatorId, baseCommentNotification);
    }

    if (parentComment && parentComment.authorId !== viewerId) {
      setRecipient(parentComment.authorId, {
        type: 'comment_replied',
        title: 'New reply',
      });
    }

    const mentionedUserIds = extractMentionedUserIds(args.body);
    if (mentionedUserIds.length > 0) {
      let projectMemberIds: Set<string> | null = null;
      if (issue.projectId) {
        const project = await ctx.db.get('projects', issue.projectId);
        if (project) {
          projectMemberIds = new Set(project.memberIds);
        }
      }

      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId === viewerId) continue;
        const mentionedUser = await ctx.db
          .query('users')
          .withIndex('by_userId', (q) => q.eq('userId', mentionedUserId))
          .unique();
        if (!mentionedUser) continue;
        if (projectMemberIds && !projectMemberIds.has(mentionedUser.userId)) continue;

        setRecipient(mentionedUser.userId, {
          type: 'mentioned',
          title: 'You were mentioned',
        });
      }
    }

    for (const [userId, notification] of recipients) {
      await createNotification(ctx, {
        userId,
        actorId: viewerId,
        type: notification.type,
        projectId: issue.projectId ?? null,
        issueId: args.issueId,
        commentId,
        title: notification.title,
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

export const listIssueCommentsFlat = zQuery({
  args: {
    issueId: addIssueCommentArgsSchema.shape.issueId,
    limit: listIssuesArgsSchema.shape.limit,
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    return await ctx.db
      .query('issueComments')
      .withIndex('by_issue', (q) => q.eq('issueId', args.issueId))
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

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('Issue not found');
    }

    await ctx.db.patch('issues', args.issueId, { status: args.status, lastActivityAt: now });

    if (issue.creatorId !== viewerId) {
      await createNotification(ctx, {
        userId: issue.creatorId,
        actorId: viewerId,
        type: 'issue_status_changed',
        projectId: issue.projectId ?? null,
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

    const issue = await ctx.db.get('issues', args.issueId);
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

    const prevAssigneeIds = issue.assigneeIds;
    const prev = new Set(prevAssigneeIds);
    const added = nextAssigneeIds.filter((id) => !prev.has(id));

    await ctx.db.patch('issues', args.issueId, { assigneeIds: nextAssigneeIds, lastActivityAt: now });

    for (const userId of added) {
      if (userId === viewerId) continue;
      await createNotification(ctx, {
        userId,
        actorId: viewerId,
        type: 'issue_assigned',
        projectId: issue.projectId ?? null,
        issueId: args.issueId,
        commentId: null,
        title: 'Assigned to an issue',
        body: issue.title,
      });
    }

    return null;
  },
});

export const setIssueLabels = zMutation({
  args: setIssueLabelsArgsSchema,
  handler: async (ctx, args) => {
    await requireViewerId(ctx);
    const now = Date.now();

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('Issue not found');
    }

    await ctx.db.patch('issues', args.issueId, {
      labels: normalizeIssueLabels(args.labels),
      lastActivityAt: now,
    });

    return null;
  },
});

export const toggleIssueReaction = zMutation({
  args: toggleReactionArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const commentId = args.commentId ?? null;
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('Issue not found');
    }

    if (commentId) {
      const comment = await ctx.db.get('issueComments', commentId);
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
      await ctx.db.delete('issueReactions', existing._id);
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
      const comment = await ctx.db.get('issueComments', commentId);
      if (comment && comment.authorId !== viewerId) {
        await createNotification(ctx, {
          userId: comment.authorId,
          actorId: viewerId,
          type: 'reaction_added',
          projectId: issue.projectId ?? null,
          issueId: args.issueId,
          commentId,
          title: 'Reaction on your comment',
          body: args.emoji,
        });
      }
    } else {
      if (issue.creatorId !== viewerId) {
        await createNotification(ctx, {
          userId: issue.creatorId,
          actorId: viewerId,
          type: 'reaction_added',
          projectId: issue.projectId ?? null,
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
