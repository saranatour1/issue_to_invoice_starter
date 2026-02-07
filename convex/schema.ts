import { defineSchema, defineTable } from 'convex/server';
import { zodToConvexFields } from 'convex-helpers/server/zod4';

import {
  issueCommentTableFields,
  issueFavoriteTableFields,
  issueReactionTableFields,
  issueTableFields,
  notificationTableFields,
  projectTableFields,
  timeEntryTableFields,
  userTableFields,
} from './issueModel';

export default defineSchema({
  users: defineTable(zodToConvexFields(userTableFields))
    .index('by_userId', ['userId'])
    .index('by_tokenIdentifier', ['tokenIdentifier']),

  projects: defineTable(zodToConvexFields(projectTableFields))
    .index('by_archived', ['archivedAt'])
    .index('by_creator', ['creatorId'])
    .index('by_last_activity', ['lastActivityAt']),

  issues: defineTable(zodToConvexFields(issueTableFields))
    .index('by_status', ['status'])
    .index('by_status_parent_last_activity', ['status', 'parentIssueId', 'lastActivityAt'])
    .index('by_creator', ['creatorId'])
    .index('by_project_last_activity', ['projectId', 'lastActivityAt'])
    .index('by_project_parent_last_activity', ['projectId', 'parentIssueId', 'lastActivityAt'])
    .index('by_source_external', ['source', 'externalId'])
    .index('by_archived', ['archivedAt'])
    .index('by_parent_last_activity', ['parentIssueId', 'lastActivityAt'])
    .index('by_last_activity', ['lastActivityAt']),

  issueFavorites: defineTable(zodToConvexFields(issueFavoriteTableFields))
    .index('by_user_issue', ['userId', 'issueId'])
    .index('by_user_created', ['userId', 'createdAt'])
    .index('by_issue', ['issueId']),

  issueComments: defineTable(zodToConvexFields(issueCommentTableFields))
    .index('by_issue', ['issueId'])
    .index('by_issue_parent', ['issueId', 'parentCommentId'])
    .index('by_author', ['authorId']),

  issueReactions: defineTable(zodToConvexFields(issueReactionTableFields))
    .index('by_issue', ['issueId'])
    .index('by_comment', ['commentId'])
    .index('by_target_user_emoji', ['issueId', 'commentId', 'userId', 'emoji']),

  timeEntries: defineTable(zodToConvexFields(timeEntryTableFields))
    .index('by_user_started', ['userId', 'startedAt'])
    .index('by_user_ended', ['userId', 'endedAt'])
    .index('by_issue_started', ['issueId', 'startedAt'])
    .index('by_issue_user_started', ['issueId', 'userId', 'startedAt'])
    .index('by_project_started', ['projectId', 'startedAt']),

  notifications: defineTable(zodToConvexFields(notificationTableFields))
    .index('by_user', ['userId'])
    .index('by_user_read', ['userId', 'readAt']),
});
