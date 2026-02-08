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
export const IssueLabelSchema = z.string().min(1).max(32);

export const DashboardViewPreferenceSchema = z.enum(['issues', 'time', 'invoices', 'settings']);
export type DashboardViewPreference = z.infer<typeof DashboardViewPreferenceSchema>;

export const InvoiceCurrencySchema = z.enum(['USD']);
export type InvoiceCurrency = z.infer<typeof InvoiceCurrencySchema>;

export const InvoiceStatusSchema = z.enum(['saved', 'sent', 'paid', 'void']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const IssueLayoutPreferenceSchema = z.enum(['list', 'board']);
export type IssueLayoutPreference = z.infer<typeof IssueLayoutPreferenceSchema>;

export const IssueStatusFilterPreferenceSchema = z.enum(['all', 'open', 'in_progress', 'done', 'closed']);
export type IssueStatusFilterPreference = z.infer<typeof IssueStatusFilterPreferenceSchema>;

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
export const InvoiceIdSchema = zid('invoices');

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
  labels: z.array(IssueLabelSchema).max(20).optional(),

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

  preferredName: z.string().max(200).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  defaultDashboardView: DashboardViewPreferenceSchema.optional(),
  issueLayoutPreference: IssueLayoutPreferenceSchema.optional(),
  issueStatusFilterPreference: IssueStatusFilterPreferenceSchema.optional(),
  issueFavoritesOnlyPreference: z.boolean().optional(),

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
  invoiceId: InvoiceIdSchema.nullable().optional(),

  description: z.string().max(500).nullable(),
  startedAt: z.number().int(),
  endedAt: z.number().int().nullable(),
};

export const invoiceTableFields = {
  invoiceNumber: z.string().min(1).max(64),
  creatorId: z.string(),
  projectId: ProjectIdSchema,
  status: InvoiceStatusSchema,
  currency: InvoiceCurrencySchema,
  hourlyRateCents: z.number().int().nonnegative(),
  notes: z.string().max(50_000).nullable().optional(),
  periodStart: z.number().int(),
  periodEnd: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  sentAt: z.number().int().nullable().optional(),
  paidAt: z.number().int().nullable().optional(),
  voidedAt: z.number().int().nullable().optional(),
};

export const createIssueArgsSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  parentIssueId: IssueIdSchema.optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(50_000).optional(),
  estimateMinutes: z.number().int().nonnegative().optional(),
  priority: IssuePrioritySchema.optional(),
  labels: z.array(IssueLabelSchema).max(20).optional(),
});

export const setIssueAssigneesArgsSchema = z.object({
  issueId: IssueIdSchema,
  assigneeIds: z.array(z.string()).max(50),
});

export const setIssueLabelsArgsSchema = z.object({
  issueId: IssueIdSchema,
  labels: z.array(IssueLabelSchema).max(20),
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

export const addProjectMemberArgsSchema = z.object({
  projectId: ProjectIdSchema,
  identifier: z.string().min(1).max(320),
});

export const removeProjectMemberArgsSchema = z.object({
  projectId: ProjectIdSchema,
  userId: z.string().min(1).max(256),
});

export const updateViewerSettingsArgsSchema = z.object({
  preferredName: z.string().max(200).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  defaultDashboardView: DashboardViewPreferenceSchema.optional(),
  issueLayoutPreference: IssueLayoutPreferenceSchema.optional(),
  issueStatusFilterPreference: IssueStatusFilterPreferenceSchema.optional(),
  issueFavoritesOnlyPreference: z.boolean().optional(),
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

export const listEndedTimeEntriesForViewerInRangeArgsSchema = z.object({
  projectId: ProjectIdSchema,
  start: z.number().int(),
  end: z.number().int(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const finalizeInvoiceFromDraftArgsSchema = z.object({
  projectId: ProjectIdSchema,
  periodStart: z.number().int(),
  periodEnd: z.number().int(),
  hourlyRateCents: z.number().int().nonnegative(),
  currency: InvoiceCurrencySchema,
  timeEntryIds: z.array(TimeEntryIdSchema).min(1).max(200),
  notes: z.string().max(50_000).optional(),
});

export const updateInvoiceArgsSchema = z.object({
  invoiceId: InvoiceIdSchema,
  status: InvoiceStatusSchema.optional(),
  hourlyRateCents: z.number().int().nonnegative().optional(),
  notes: z.string().max(50_000).nullable().optional(),
});

export const listInvoicesForViewerArgsSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  status: InvoiceStatusSchema.optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const getInvoiceArgsSchema = z.object({
  invoiceId: InvoiceIdSchema,
});

export const listTimeEntriesForInvoiceArgsSchema = z.object({
  invoiceId: InvoiceIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});
