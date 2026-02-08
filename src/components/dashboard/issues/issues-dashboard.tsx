import { useNavigate } from '@tanstack/react-router';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import { IssueInfoPane } from './issue-info-pane';
import { IssuesDashboardContext } from './issues-context';
import { IssuesMiddlePane } from './issues-middle-pane';
import { IssuesSidebar } from './issues-sidebar';
import type { ReactNode, SubmitEvent } from 'react';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import type { EnrichedTimeEntry, IssuePriority, IssueStatus, IssueStatusFilter, IssuesLayout, MinimalUser } from './types';

type StartTimerMutation = {
  mutate: (args: { issueId?: Id<'issues'>; projectId?: Id<'projects'>; description?: string }) => void;
  isPending: boolean;
  error: unknown;
};

type StopTimerMutation = {
  mutate: (args: { timeEntryId?: Id<'timeEntries'> }) => void;
  isPending: boolean;
  error: unknown;
};

export function IssuesDashboard({
  projectId,
  issueIdParam,
  projects,
  viewerId,
  now,
  activeTimer,
  startTimer,
  stopTimer,
  children,
}: {
  projectId: string;
  issueIdParam: string | null;
  projects: Array<Doc<'projects'>>;
  viewerId: string | null;
  now: number;
  activeTimer: EnrichedTimeEntry | null;
  startTimer: StartTimerMutation;
  stopTimer: StopTimerMutation;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const selectedProjectId: Id<'projects'> | null = projectId === 'all' ? null : (projectId as Id<'projects'>);
  const projectById = useMemo(() => {
    const map = new Map<Id<'projects'>, Doc<'projects'>>();
    for (const project of projects) {
      map.set(project._id, project);
    }
    return map;
  }, [projects]);

  const changeProject = (nextProjectId: string) => {
    navigate({ to: '/$projectId/issues', params: { projectId: nextProjectId } });
  };

  const openIssue = (issueId: Id<'issues'>) => {
    navigate({ to: '/$projectId/issues/$issueId', params: { projectId, issueId } });
  };

  const closeIssue = () => {
    navigate({ to: '/$projectId/issues', params: { projectId } });
  };

  const routeIssueId = issueIdParam ? (issueIdParam as Id<'issues'>) : null;
  const selectedIssueId = routeIssueId;

  const viewerSettings = useQuery(convexQuery(api.users.getViewerSettings, {}));

  const [issueStatusFilter, setIssueStatusFilter] = useState<IssueStatusFilter>('open');
  const [issuesLayout, setIssuesLayout] = useState<IssuesLayout>('list');
  const [issueSearch, setIssueSearch] = useState('');
  const [issueFavoritesOnly, setIssueFavoritesOnly] = useState(false);
  const [issuePreferencesInitialized, setIssuePreferencesInitialized] = useState(false);

  useEffect(() => {
    if (issuePreferencesInitialized || !viewerSettings.data) return;
    const nextLayout = viewerSettings.data.issueLayoutPreference as IssuesLayout;
    setIssuesLayout(nextLayout);
    setIssueStatusFilter(nextLayout === 'board' ? 'all' : (viewerSettings.data.issueStatusFilterPreference as IssueStatusFilter));
    setIssueFavoritesOnly(!!viewerSettings.data.issueFavoritesOnlyPreference);
    setIssuePreferencesInitialized(true);
  }, [issuePreferencesInitialized, viewerSettings.data]);

  const issueListArgs = useMemo(() => {
    const args: { projectId?: Id<'projects'>; status?: IssueStatus; limit: number } = { limit: 50 };
    if (selectedProjectId) args.projectId = selectedProjectId;
    if (issueStatusFilter !== 'all') args.status = issueStatusFilter;
    return args;
  }, [issueStatusFilter, selectedProjectId]);

  const issues = useQuery(convexQuery(api.issues.listIssues, issueListArgs));

  const favoriteIssueIds = useQuery(convexQuery(api.issues.listFavoriteIssueIds, { limit: 200 }));
  const favoriteIssueIdSet = useMemo(
    () => new Set<Id<'issues'>>(favoriteIssueIds.data ?? []),
    [favoriteIssueIds.data],
  );

  const filteredIssues = useMemo(() => {
    const q = issueSearch.trim().toLowerCase();
    let items = issues.data ?? [];
    if (issueFavoritesOnly) {
      items = items.filter((issue) => favoriteIssueIdSet.has(issue._id));
    }
    if (!q) return items;
    return items.filter(
      (issue) =>
        issue.title.toLowerCase().includes(q) ||
        (issue.labels ?? []).some((label: string) => label.toLowerCase().includes(q)),
    );
  }, [favoriteIssueIdSet, issueFavoritesOnly, issueSearch, issues.data]);

  const issuesByStatus = useMemo(() => {
    const buckets: Record<IssueStatus, Array<Doc<'issues'>>> = {
      open: [],
      in_progress: [],
      done: [],
      closed: [],
    };

    for (const issue of filteredIssues) {
      const status = issue.status as IssueStatus;
      buckets[status].push(issue);
    }

    return buckets;
  }, [filteredIssues]);

  const selectedIssue = useQuery(
    convexQuery(api.issues.getIssue, selectedIssueId ? { issueId: selectedIssueId } : 'skip'),
  );
  const selectedIssueComments = useQuery(
    convexQuery(
      api.issues.listIssueCommentsFlat,
      selectedIssueId ? { issueId: selectedIssueId, limit: 200 } : 'skip',
    ),
  );
  const subIssuesQuery = useQuery(
    convexQuery(
      api.issues.listIssues,
      selectedIssueId ? { parentIssueId: selectedIssueId, limit: 50 } : 'skip',
    ),
  );
  const subIssues = subIssuesQuery.data ?? [];

  const parentIssue = useQuery(
    convexQuery(
      api.issues.getIssue,
      selectedIssue.data?.parentIssueId ? { issueId: selectedIssue.data.parentIssueId } : 'skip',
    ),
  );

  const blockedByIssuesQuery = useQuery(
    convexQuery(
      api.issues.listIssuesByIds,
      selectedIssue.data && (selectedIssue.data.blockedByIssueIds ?? []).length
        ? { issueIds: selectedIssue.data.blockedByIssueIds ?? [] }
        : 'skip',
    ),
  );

  const relatedIssuesQuery = useQuery(
    convexQuery(
      api.issues.listIssuesByIds,
      selectedIssue.data && (selectedIssue.data.relatedIssueIds ?? []).length
        ? { issueIds: selectedIssue.data.relatedIssueIds ?? [] }
        : 'skip',
    ),
  );

  const issueTimeEntriesQuery = useQuery(
    convexQuery(
      api.time.listForIssueForViewer,
      selectedIssueId ? { issueId: selectedIssueId, limit: 50 } : 'skip',
    ),
  );

  const blockedByIssueIdSet = useMemo(
    () => new Set<Id<'issues'>>(selectedIssue.data?.blockedByIssueIds ?? []),
    [selectedIssue.data?.blockedByIssueIds],
  );
  const relatedIssueIdSet = useMemo(
    () => new Set<Id<'issues'>>(selectedIssue.data?.relatedIssueIds ?? []),
    [selectedIssue.data?.relatedIssueIds],
  );

  const linkCandidateIssues = useMemo(() => {
    const map = new Map<Id<'issues'>, Doc<'issues'>>();
    for (const issue of issues.data ?? []) map.set(issue._id, issue);
    for (const issue of subIssues) map.set(issue._id, issue);
    if (selectedIssue.data) map.set(selectedIssue.data._id, selectedIssue.data);
    if (parentIssue.data) map.set(parentIssue.data._id, parentIssue.data);
    return Array.from(map.values());
  }, [issues.data, parentIssue.data, selectedIssue.data, subIssues]);

  const blockedByCandidateIssues = useMemo(() => {
    if (!selectedIssueId) return [];
    return linkCandidateIssues
      .filter((issue) => issue._id !== selectedIssueId && !blockedByIssueIdSet.has(issue._id))
      .slice(0, 50);
  }, [blockedByIssueIdSet, linkCandidateIssues, selectedIssueId]);

  const relatedCandidateIssues = useMemo(() => {
    if (!selectedIssueId) return [];
    return linkCandidateIssues
      .filter((issue) => issue._id !== selectedIssueId && !relatedIssueIdSet.has(issue._id))
      .slice(0, 50);
  }, [linkCandidateIssues, relatedIssueIdSet, selectedIssueId]);

  const userIdsForLookup = useMemo(() => {
    const ids = new Set<string>();

    for (const issue of filteredIssues) {
      ids.add(issue.creatorId);
      for (const assigneeId of issue.assigneeIds) ids.add(assigneeId);
    }

    const selected = selectedIssue.data;
    if (selected) {
      ids.add(selected.creatorId);
      for (const assigneeId of selected.assigneeIds) ids.add(assigneeId);
    }

    for (const subIssue of subIssues) {
      ids.add(subIssue.creatorId);
      for (const assigneeId of subIssue.assigneeIds) ids.add(assigneeId);
    }

    for (const comment of selectedIssueComments.data ?? []) {
      ids.add(comment.authorId);
    }

    if (viewerId) ids.add(viewerId);

    return Array.from(ids);
  }, [filteredIssues, selectedIssue.data, selectedIssueComments.data, subIssues, viewerId]);

  const users = useQuery(
    convexQuery(api.users.listByUserIds, userIdsForLookup.length ? { userIds: userIdsForLookup } : 'skip'),
  );

  const userById = useMemo(() => {
    const map = new Map<string, MinimalUser>();
    for (const user of users.data ?? []) {
      map.set(user.userId, { name: user.name, email: user.email, pictureUrl: user.pictureUrl });
    }
    return map;
  }, [users.data]);

  const createIssueFn = useConvexMutation(api.issues.createIssue);
  const setIssueStatusFn = useConvexMutation(api.issues.setIssueStatus);
  const setIssueAssigneesFn = useConvexMutation(api.issues.setIssueAssignees);
  const setIssueLabelsFn = useConvexMutation(api.issues.setIssueLabels);
  const addIssueCommentFn = useConvexMutation(api.issues.addIssueComment);
  const toggleIssueFavoriteFn = useConvexMutation(api.issues.toggleIssueFavorite);
  const toggleIssueLinkFn = useConvexMutation(api.issues.toggleIssueLink);

  const createIssue = useMutation({
    mutationFn: (args: {
      projectId?: Id<'projects'>;
      parentIssueId?: Id<'issues'>;
      title: string;
      description?: string;
      estimateMinutes?: number;
      priority?: IssuePriority;
      labels?: Array<string>;
    }) => createIssueFn(args),
    onSuccess: async (issueId) => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
      navigate({ to: '/$projectId/issues/$issueId', params: { projectId, issueId } });
    },
  });

  const setIssueStatus = useMutation({
    mutationFn: (args: { issueId: Id<'issues'>; status: IssueStatus }) => setIssueStatusFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const setIssueAssignees = useMutation({
    mutationFn: (args: { issueId: Id<'issues'>; assigneeIds: Array<string> }) => setIssueAssigneesFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const setIssueLabels = useMutation({
    mutationFn: (args: { issueId: Id<'issues'>; labels: Array<string> }) => setIssueLabelsFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const addIssueComment = useMutation({
    mutationFn: (args: { issueId: Id<'issues'>; parentCommentId?: Id<'issueComments'> | null; body: string }) =>
      addIssueCommentFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const toggleIssueFavorite = useMutation({
    mutationFn: (args: { issueId: Id<'issues'> }) => toggleIssueFavoriteFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const toggleIssueLink = useMutation({
    mutationFn: (args: { issueId: Id<'issues'>; otherIssueId: Id<'issues'>; type: 'blocked_by' | 'related' }) =>
      toggleIssueLinkFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDescription, setNewIssueDescription] = useState('');
  const [newIssueEstimate, setNewIssueEstimate] = useState('');
  const [newIssueLabels, setNewIssueLabels] = useState('');
  const [newIssuePriority, setNewIssuePriority] = useState<IssuePriority>('medium');
  const [newSubIssueTitle, setNewSubIssueTitle] = useState('');
  const [newSubIssuePriority, setNewSubIssuePriority] = useState<IssuePriority>('medium');
  const [blockedByPickerNonce, setBlockedByPickerNonce] = useState(0);
  const [relatedPickerNonce, setRelatedPickerNonce] = useState(0);

  const [newCommentBody, setNewCommentBody] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<Id<'issueComments'> | null>(null);
  const [issueLabelsInput, setIssueLabelsInput] = useState('');

  useEffect(() => {
    if (!selectedIssue.data) {
      setIssueLabelsInput('');
      return;
    }
    setIssueLabelsInput((selectedIssue.data.labels ?? []).join(', '));
  }, [selectedIssue.data?._id, selectedIssue.data?.labels]);

  useEffect(() => {
    if (!selectedIssueId) return;
    if (selectedIssue.data?.parentIssueId) return;
    const stillVisible = filteredIssues.some((issue) => issue._id === selectedIssueId);
    if (stillVisible) return;
    navigate({ to: '/$projectId/issues', params: { projectId }, replace: true });
  }, [filteredIssues, navigate, projectId, selectedIssue.data?.parentIssueId, selectedIssueId]);

  const handleCreateIssue = async (event: SubmitEvent) => {
    event.preventDefault();
    const title = newIssueTitle.trim();
    if (!title) return;

    const estimate = parseMinutes(newIssueEstimate);

    await createIssue.mutateAsync({
      projectId: selectedProjectId ?? undefined,
      title,
      description: newIssueDescription.trim() ? newIssueDescription.trim() : undefined,
      estimateMinutes: estimate ?? undefined,
      priority: newIssuePriority,
      labels: parseIssueLabelsInput(newIssueLabels),
    });

    setNewIssueTitle('');
    setNewIssueDescription('');
    setNewIssueEstimate('');
    setNewIssueLabels('');
    setNewIssuePriority('medium');
  };

  const handleCreateSubIssue = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!selectedIssueId) return;
    const title = newSubIssueTitle.trim();
    if (!title) return;

    await createIssue.mutateAsync({
      parentIssueId: selectedIssueId,
      title,
      priority: newSubIssuePriority,
    });

    setNewSubIssueTitle('');
    setNewSubIssuePriority('medium');
  };

  const handleAddComment = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!selectedIssueId) return;
    const body = newCommentBody.trim();
    if (!body) return;

    await addIssueComment.mutateAsync({ issueId: selectedIssueId, parentCommentId: replyToCommentId, body });
    setNewCommentBody('');
    setReplyToCommentId(null);
  };

  const handleSaveIssueLabels = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!selectedIssueId) return;
    const labels = parseIssueLabelsInput(issueLabelsInput);
    await setIssueLabels.mutateAsync({ issueId: selectedIssueId, labels });
    setIssueLabelsInput(labels.join(', '));
  };

  const value = useMemo(
    () => ({
      projectId,
      projects,
      selectedProjectId,
      projectById,
      viewerId,
      now,
      activeTimer,
      startTimer,
      stopTimer,
      openIssue,
      closeIssue,
      changeProject,
      issueSearch,
      setIssueSearch,
      issueStatusFilter,
      setIssueStatusFilter,
      issueFavoritesOnly,
      setIssueFavoritesOnly,
      issuesLayout,
      setIssuesLayout,
      issuesLoading: issues.isLoading,
      filteredIssues,
      issuesByStatus,
      favoriteIssueIdSet,
      toggleIssueFavorite,
      selectedIssueId,
      selectedIssue: selectedIssue.data ?? null,
      newIssueTitle,
      setNewIssueTitle,
      newIssueDescription,
      setNewIssueDescription,
      newIssueEstimate,
      setNewIssueEstimate,
      newIssueLabels,
      setNewIssueLabels,
      newIssuePriority,
      setNewIssuePriority,
      handleCreateIssue,
      createIssuePending: createIssue.isPending,
      createIssueError: createIssue.error,
      selectedIssueComments: selectedIssueComments.data ?? [],
      userById,
      newCommentBody,
      setNewCommentBody,
      replyToCommentId,
      setReplyToCommentId,
      handleAddComment,
      addIssueCommentPending: addIssueComment.isPending,
      addIssueCommentError: addIssueComment.error,
      issueLabelsInput,
      setIssueLabelsInput,
      handleSaveIssueLabels,
      setIssueLabelsPending: setIssueLabels.isPending,
      setIssueLabelsError: setIssueLabels.error,
      setIssueStatus,
      setIssueAssignees,
      subIssuesLoading: subIssuesQuery.isLoading,
      subIssues,
      newSubIssueTitle,
      setNewSubIssueTitle,
      newSubIssuePriority,
      setNewSubIssuePriority,
      handleCreateSubIssue,
      createSubIssuePending: createIssue.isPending,
      createSubIssueError: createIssue.error,
      parentIssue: parentIssue.data ?? null,
      blockedByPickerNonce,
      setBlockedByPickerNonce,
      relatedPickerNonce,
      setRelatedPickerNonce,
      blockedByIssuesLoading: blockedByIssuesQuery.isLoading,
      blockedByIssues: blockedByIssuesQuery.data ?? [],
      relatedIssuesLoading: relatedIssuesQuery.isLoading,
      relatedIssues: relatedIssuesQuery.data ?? [],
      blockedByCandidateIssues,
      relatedCandidateIssues,
      toggleIssueLink,
      issueTimeEntriesLoading: issueTimeEntriesQuery.isLoading,
      issueTimeEntries: (issueTimeEntriesQuery.data ?? []) as Array<EnrichedTimeEntry>,
    }),
    [
      activeTimer,
      addIssueComment.error,
      addIssueComment.isPending,
      blockedByCandidateIssues,
      blockedByIssuesQuery.data,
      blockedByIssuesQuery.isLoading,
      blockedByPickerNonce,
      closeIssue,
      createIssue.error,
      createIssue.isPending,
      filteredIssues,
      issueFavoritesOnly,
      issueLabelsInput,
      issueListArgs,
      issueSearch,
      issueStatusFilter,
      issueTimeEntriesQuery.data,
      issueTimeEntriesQuery.isLoading,
      issues.isLoading,
      issuesByStatus,
      issuesLayout,
      newCommentBody,
      newIssueDescription,
      newIssueEstimate,
      newIssueLabels,
      newIssuePriority,
      newIssueTitle,
      newSubIssuePriority,
      newSubIssueTitle,
      now,
      openIssue,
      parentIssue.data,
      projectById,
      projectId,
      projects,
      relatedCandidateIssues,
      relatedIssuesQuery.data,
      relatedIssuesQuery.isLoading,
      relatedPickerNonce,
      replyToCommentId,
      selectedIssue.data,
      selectedIssueComments.data,
      selectedIssueId,
      selectedProjectId,
      setIssueAssignees,
      setIssueLabels.error,
      setIssueLabels.isPending,
      setIssueStatus,
      startTimer,
      stopTimer,
      subIssues,
      subIssuesQuery.isLoading,
      toggleIssueFavorite,
      favoriteIssueIdSet,
      toggleIssueLink,
      userById,
      viewerId,
    ],
  );

  return <IssuesDashboardContext.Provider value={value}>{children}</IssuesDashboardContext.Provider>;
}

export function IssuesDashboardContent() {
  return (
    <div className="min-h-0 flex-1">
      <div className="md:hidden p-4">
        <IssuesSidebar mode="mobile" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 overflow-auto">
          <IssuesMiddlePane />
        </div>
        <div className="min-h-0 overflow-auto lg:border-l lg:border-border/60">
          <IssueInfoPane />
        </div>
      </div>
    </div>
  );
}

function parseMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return Math.round(n);
}

function parseIssueLabelsInput(value: string): Array<string> {
  const labels = value
    .split(',')
    .map((label) => label.trim().replace(/\s+/g, ' '))
    .filter((label) => label.length > 0)
    .map((label) => label.slice(0, 32));

  const deduped: Array<string> = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(label);
    if (deduped.length >= 20) break;
  }

  return deduped;
}
