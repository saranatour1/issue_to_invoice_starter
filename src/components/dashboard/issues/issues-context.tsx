import { createContext, useContext } from 'react';
import type { SubmitEvent } from 'react';

import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import type {
  EnrichedTimeEntry,
  IssuePriority,
  IssueStatus,
  IssueStatusFilter,
  IssuesLayout,
  MinimalUser,
} from './types';

export type IssuesDashboardContextValue = {
  projectId: string;
  projects: Array<Doc<'projects'>>;
  selectedProjectId: Id<'projects'> | null;
  projectById: Map<Id<'projects'>, Doc<'projects'>>;

  viewerId: string | null;
  now: number;
  activeTimer: EnrichedTimeEntry | null;
  startTimer: {
    mutate: (args: { issueId?: Id<'issues'>; projectId?: Id<'projects'>; description?: string }) => void;
    isPending: boolean;
    error: unknown;
  };
  stopTimer: {
    mutate: (args: { timeEntryId?: Id<'timeEntries'> }) => void;
    isPending: boolean;
    error: unknown;
  };

  openIssue: (issueId: Id<'issues'>) => void;
  closeIssue: () => void;
  changeProject: (projectId: string) => void;

  issueSearch: string;
  setIssueSearch: (value: string) => void;
  issueStatusFilter: IssueStatusFilter;
  setIssueStatusFilter: (value: IssueStatusFilter) => void;
  issueFavoritesOnly: boolean;
  setIssueFavoritesOnly: (value: boolean | ((prev: boolean) => boolean)) => void;
  issuesLayout: IssuesLayout;
  setIssuesLayout: (value: IssuesLayout) => void;

  issuesLoading: boolean;
  filteredIssues: Array<Doc<'issues'>>;
  issuesByStatus: Record<IssueStatus, Array<Doc<'issues'>>>;

  favoriteIssueIdSet: Set<Id<'issues'>>;
  toggleIssueFavorite: {
    mutate: (args: { issueId: Id<'issues'> }) => void;
    isPending: boolean;
    error: unknown;
  };

  selectedIssueId: Id<'issues'> | null;
  selectedIssueLoading: boolean;
  selectedIssue: Doc<'issues'> | null;

  newIssueTitle: string;
  setNewIssueTitle: (value: string) => void;
  newIssueDescription: string;
  setNewIssueDescription: (value: string) => void;
  newIssueEstimate: string;
  setNewIssueEstimate: (value: string) => void;
  newIssueLabels: string;
  setNewIssueLabels: (value: string) => void;
  newIssuePriority: IssuePriority;
  setNewIssuePriority: (value: IssuePriority) => void;
  handleCreateIssue: (event: SubmitEvent) => void;
  createIssuePending: boolean;
  createIssueError: unknown;

  selectedIssueComments: Array<{
    _id: Id<'issueComments'>;
    parentCommentId: Id<'issueComments'> | null;
    authorId: string;
    body: string;
    deletedAt: number | null;
    editedAt: number | null;
  }>;
  userById: Map<string, MinimalUser>;

  newCommentBody: string;
  setNewCommentBody: (value: string) => void;
  replyToCommentId: Id<'issueComments'> | null;
  setReplyToCommentId: (value: Id<'issueComments'> | null) => void;
  handleAddComment: (event: SubmitEvent) => void;
  addIssueCommentPending: boolean;
  addIssueCommentError: unknown;

  issueLabelsInput: string;
  setIssueLabelsInput: (value: string) => void;
  handleSaveIssueLabels: (event: SubmitEvent) => void;
  setIssueLabelsPending: boolean;
  setIssueLabelsError: unknown;

  setIssueStatus: {
    mutate: (args: { issueId: Id<'issues'>; status: IssueStatus }) => void;
    isPending: boolean;
    error: unknown;
  };
  setIssueAssignees: {
    mutate: (args: { issueId: Id<'issues'>; assigneeIds: Array<string> }) => void;
    isPending: boolean;
    error: unknown;
  };

  subIssuesLoading: boolean;
  subIssues: Array<Doc<'issues'>>;
  newSubIssueTitle: string;
  setNewSubIssueTitle: (value: string) => void;
  newSubIssuePriority: IssuePriority;
  setNewSubIssuePriority: (value: IssuePriority) => void;
  handleCreateSubIssue: (event: SubmitEvent) => void;
  createSubIssuePending: boolean;
  createSubIssueError: unknown;

  parentIssue: Doc<'issues'> | null;

  blockedByPickerNonce: number;
  setBlockedByPickerNonce: (updater: (prev: number) => number) => void;
  relatedPickerNonce: number;
  setRelatedPickerNonce: (updater: (prev: number) => number) => void;
  blockedByIssuesLoading: boolean;
  blockedByIssues: Array<Doc<'issues'>>;
  relatedIssuesLoading: boolean;
  relatedIssues: Array<Doc<'issues'>>;
  blockedByCandidateIssues: Array<Doc<'issues'>>;
  relatedCandidateIssues: Array<Doc<'issues'>>;
  toggleIssueLink: {
    mutate: (args: { issueId: Id<'issues'>; otherIssueId: Id<'issues'>; type: 'blocked_by' | 'related' }) => void;
    isPending: boolean;
    error: unknown;
  };

  issueTimeEntriesLoading: boolean;
  issueTimeEntries: Array<EnrichedTimeEntry>;
};

const IssuesDashboardContext = createContext<IssuesDashboardContextValue | null>(null);

export function useIssuesDashboard() {
  const ctx = useContext(IssuesDashboardContext);
  if (!ctx) {
    throw new Error('useIssuesDashboard must be used within <IssuesDashboard>.');
  }
  return ctx;
}

export { IssuesDashboardContext };
