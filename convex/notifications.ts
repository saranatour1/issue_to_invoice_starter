import { ConvexError } from 'convex/values';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import { listNotificationsArgsSchema, markAllNotificationsReadArgsSchema, markNotificationReadArgsSchema } from './issueModel';
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

export const listForViewer = zQuery({
  args: listNotificationsArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const limit = args.limit ?? 50;

    if (args.projectId) {
      if (args.unreadOnly) {
        return await ctx.db
          .query('notifications')
          .withIndex('by_user_project_read', (q) => q.eq('userId', viewerId).eq('projectId', args.projectId).eq('readAt', null))
          .order('desc')
          .take(limit);
      }

      return await ctx.db
        .query('notifications')
        .withIndex('by_user_project', (q) => q.eq('userId', viewerId).eq('projectId', args.projectId))
        .order('desc')
        .take(limit);
    }

    if (args.unreadOnly) {
      return await ctx.db
        .query('notifications')
        .withIndex('by_user_read', (q) => q.eq('userId', viewerId).eq('readAt', null))
        .order('desc')
        .take(limit);
    }

    return await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', viewerId))
      .order('desc')
      .take(limit);
  },
});

export const markRead = zMutation({
  args: markNotificationReadArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const notification = await ctx.db.get('notifications', args.notificationId);
    if (!notification) {
      throw new ConvexError('Notification not found');
    }
    if (notification.userId !== viewerId) {
      throw new ConvexError('Not authorized');
    }

    if (notification.readAt !== null) {
      return null;
    }

    await ctx.db.patch('notifications', args.notificationId, { readAt: Date.now() });
    return null;
  },
});

export const markAllRead = zMutation({
  args: markAllNotificationsReadArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const unread = args.projectId
      ? await ctx.db
          .query('notifications')
          .withIndex('by_user_project_read', (q) => q.eq('userId', viewerId).eq('projectId', args.projectId).eq('readAt', null))
          .collect()
      : await ctx.db
          .query('notifications')
          .withIndex('by_user_read', (q) => q.eq('userId', viewerId).eq('readAt', null))
          .collect();

    for (const notification of unread) {
      await ctx.db.patch('notifications', notification._id, { readAt: now });
    }

    return { updatedCount: unread.length };
  },
});
