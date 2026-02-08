import type { Doc } from '../../../../convex/_generated/dataModel';

export type IssueStatus = 'open' | 'in_progress' | 'done' | 'closed';
export type IssueStatusFilter = IssueStatus | 'all';
export type IssuesLayout = 'list' | 'board' | 'table';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';

export type MinimalUser = { name: string | null; email: string | null; pictureUrl: string | null };

export type EnrichedTimeEntry = Doc<'timeEntries'> & { issueTitle: string | null; projectName: string | null };
