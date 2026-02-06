import { defineSchema, defineTable } from 'convex/server';
import { zodToConvexFields } from 'convex-helpers/server/zod4';

import {
  issueCommentTableFields,
  issueReactionTableFields,
  issueTableFields,
  notificationTableFields,
  userTableFields,
} from './issueModel';

export default defineSchema({
  users: defineTable(zodToConvexFields(userTableFields))
    .index('by_userId', ['userId'])
    .index('by_tokenIdentifier', ['tokenIdentifier']),

  issues: defineTable(zodToConvexFields(issueTableFields))
    .index('by_status', ['status'])
    .index('by_creator', ['creatorId'])
    .index('by_source_external', ['source', 'externalId'])
    .index('by_archived', ['archivedAt'])
    .index('by_last_activity', ['lastActivityAt']),

  issueComments: defineTable(zodToConvexFields(issueCommentTableFields))
    .index('by_issue', ['issueId'])
    .index('by_issue_parent', ['issueId', 'parentCommentId'])
    .index('by_author', ['authorId']),

  issueReactions: defineTable(zodToConvexFields(issueReactionTableFields))
    .index('by_issue', ['issueId'])
    .index('by_comment', ['commentId'])
    .index('by_target_user_emoji', ['issueId', 'commentId', 'userId', 'emoji']),

  notifications: defineTable(zodToConvexFields(notificationTableFields))
    .index('by_user', ['userId'])
    .index('by_user_read', ['userId', 'readAt']),
});
