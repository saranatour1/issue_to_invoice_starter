import * as z from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';

export const IssueSourceSchema = z.enum(['app', 'github', 'linear']);
export type IssueSource = z.infer<typeof IssueSourceSchema>;

export const IssueStatusSchema = z.enum(['open', 'in_progress', 'done', 'closed']);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;

export const IssuePrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type IssuePriority = z.infer<typeof IssuePrioritySchema>;

export const IssueLinkTypeSchema = z.enum(['blocked_by', 'related']);
export type IssueLinkType = z.infer<typeof IssueLinkTypeSchema>;

export const NotificationTypeSchema = z.enum([
  'issue_created',
  'issue_status_changed',
  'issue_assigned',
  'comment_added',
  'comment_replied',
  'reaction_added',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const IssueIdSchema = zid('issues');
export const IssueCommentIdSchema = zid('issueComments');
export const IssueFavoriteIdSchema = zid('issueFavorites');
export const NotificationIdSchema = zid('notifications');
export const ProjectIdSchema = zid('projects');
export const TimeEntryIdSchema = zid('timeEntries');

export const issueTableFields = {
  source: IssueSourceSchema,
  externalId: z.string().max(256).nullable(),

  projectId: ProjectIdSchema.nullable(),
  parentIssueId: IssueIdSchema.nullable().optional(),

  title: z.string().min(1).max(200),
  description: z.string().max(50_000).nullable(),

  status: IssueStatusSchema,
  priority: IssuePrioritySchema,
  estimateMinutes: z.number().int().nonnegative().nullable(),

  creatorId: z.string(),
  assigneeIds: z.array(z.string()),
  blockedByIssueIds: z.array(IssueIdSchema).max(50).optional(),
  relatedIssueIds: z.array(IssueIdSchema).max(50).optional(),

  archivedAt: z.number().int().nullable(),
  lastActivityAt: z.number().int(),
};

export const issueFavoriteTableFields = {
  issueId: IssueIdSchema,
  userId: z.string(),
  createdAt: z.number().int(),
};

export const issueCommentTableFields = {
  issueId: IssueIdSchema,
  parentCommentId: IssueCommentIdSchema.nullable(),

  authorId: z.string(),
  body: z.string().min(1).max(50_000),

  editedAt: z.number().int().nullable(),
  deletedAt: z.number().int().nullable(),
};

export const issueReactionTableFields = {
  issueId: IssueIdSchema,
  commentId: IssueCommentIdSchema.nullable(),

  userId: z.string(),
  emoji: z.string().min(1).max(32),
};

export const notificationTableFields = {
  userId: z.string(),
  actorId: z.string().nullable(),
  type: NotificationTypeSchema,

  issueId: IssueIdSchema.nullable(),
  commentId: IssueCommentIdSchema.nullable(),

  title: z.string().min(1).max(200),
  body: z.string().max(2_000).nullable(),

  readAt: z.number().int().nullable(),
};

export const userTableFields = {
  userId: z.string(),
  tokenIdentifier: z.string(),
  issuer: z.string(),

  name: z.string().max(200).nullable(),
  email: z.string().max(320).nullable(),
  pictureUrl: z.string().max(2048).nullable(),

  lastSeenAt: z.number().int(),
};

export const projectTableFields = {
  name: z.string().min(1).max(100),
  description: z.string().max(2_000).nullable(),
  color: z.string().max(32).nullable(),

  creatorId: z.string(),
  memberIds: z.array(z.string()),

  archivedAt: z.number().int().nullable(),
  lastActivityAt: z.number().int(),
};

export const timeEntryTableFields = {
  userId: z.string(),
  issueId: IssueIdSchema.nullable(),
  projectId: ProjectIdSchema.nullable(),

  description: z.string().max(500).nullable(),
  startedAt: z.number().int(),
  endedAt: z.number().int().nullable(),
};

export const createIssueArgsSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  parentIssueId: IssueIdSchema.optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(50_000).optional(),
  estimateMinutes: z.number().int().nonnegative().optional(),
  priority: IssuePrioritySchema.optional(),
});

export const setIssueAssigneesArgsSchema = z.object({
  issueId: IssueIdSchema,
  assigneeIds: z.array(z.string()).max(50),
});

export const listIssuesArgsSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  parentIssueId: IssueIdSchema.nullable().optional(),
  status: IssueStatusSchema.optional(),
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const listIssuesByIdsArgsSchema = z.object({
  issueIds: z.array(IssueIdSchema).max(50),
});

export const addIssueCommentArgsSchema = z.object({
  issueId: IssueIdSchema,
  parentCommentId: IssueCommentIdSchema.nullable().optional(),
  body: z.string().min(1).max(50_000),
});

export const toggleReactionArgsSchema = z.object({
  issueId: IssueIdSchema,
  commentId: IssueCommentIdSchema.nullable().optional(),
  emoji: z.string().min(1).max(32),
});

export const listNotificationsArgsSchema = z.object({
  unreadOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const markNotificationReadArgsSchema = z.object({
  notificationId: NotificationIdSchema,
});

export const toggleIssueFavoriteArgsSchema = z.object({
  issueId: IssueIdSchema,
});

export const listFavoriteIssuesArgsSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

export const toggleIssueLinkArgsSchema = z.object({
  issueId: IssueIdSchema,
  otherIssueId: IssueIdSchema,
  type: IssueLinkTypeSchema,
});

export const getUserByUserIdArgsSchema = z.object({
  userId: z.string(),
});

export const listUsersByUserIdsArgsSchema = z.object({
  userIds: z.array(z.string()).max(200),
});

export const createProjectArgsSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2_000).optional(),
  color: z.string().max(32).optional(),
});

export const listProjectsArgsSchema = z.object({
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const getProjectArgsSchema = z.object({
  projectId: ProjectIdSchema,
});

export const startTimerArgsSchema = z.object({
  issueId: IssueIdSchema.optional(),
  projectId: ProjectIdSchema.optional(),
  description: z.string().max(500).optional(),
});

export const stopTimerArgsSchema = z.object({
  timeEntryId: TimeEntryIdSchema.optional(),
});

export const listTimeEntriesArgsSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

export const listTimeEntriesForIssueArgsSchema = z.object({
  issueId: IssueIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});
