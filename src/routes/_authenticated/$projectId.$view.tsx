import { createFileRoute, redirect, useNavigate, useParams } from '@tanstack/react-router';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { SubmitEvent } from 'react';
import { useAuth } from '@workos/authkit-tanstack-react-start/client';
import {
  RiAddLine,
  RiArrowRightSLine,
  RiCheckboxCircleLine,
  RiCircleLine,
  RiCloseCircleLine,
  RiCloseLine,
  RiFileTextLine,
  RiHashtag,
  RiLoader4Line,
  RiLogoutBoxLine,
  RiNotification3Line,
  RiPlayLine,
  RiSearchLine,
  RiStopLine,
  RiTimerLine,
} from '@remixicon/react';

import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/$projectId/$view')({
  loader: ({ params }) => {
    const view = params.view;
    if (view !== 'issues' && view !== 'time' && view !== 'invoices') {
      throw redirect({
        to: '/$projectId/$view',
        params: { projectId: params.projectId, view: 'issues' },
      });
    }
  },
  component: AuthenticatedPage,
});

function AuthenticatedPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const navigate = useNavigate();
  const { projectId, view } = Route.useParams();
  const dashboardView = view as DashboardView;
  const issueParams = useParams({
    from: '/_authenticated/$projectId/$view/$issueId',
    shouldThrow: false,
  });
  const issueIdParam = (issueParams as { issueId?: string } | undefined)?.issueId ?? null;
  const routeIssueId = issueIdParam ? (issueIdParam as Id<'issues'>) : null;

  const selectedIssueId = dashboardView === 'issues' ? routeIssueId : null;
  const timeIssueId = dashboardView === 'time' ? routeIssueId : null;
  const selectedProjectId: Id<'projects'> | null = projectId === 'all' ? null : (projectId as Id<'projects'>);
  const [timeViewFilter, setTimeViewFilter] = useState<TimeViewFilter>('all');

  const upsertViewerFn = useConvexMutation(api.users.upsertViewer);
  useEffect(() => {
    void upsertViewerFn({}).catch(() => {});
  }, [upsertViewerFn]);

  const viewer = useQuery(convexQuery(api.users.getViewer, {}));

  const projects = useQuery(convexQuery(api.projects.listProjects, {}));
  const projectById = useMemo(() => {
    const map = new Map<Id<'projects'>, Doc<'projects'>>();
    for (const project of projects.data ?? []) {
      map.set(project._id, project);
    }
    return map;
  }, [projects.data]);

  const [issueStatusFilter, setIssueStatusFilter] = useState<IssueStatusFilter>('open');
  const [issueSearch, setIssueSearch] = useState('');

  const issueListArgs = useMemo(() => {
    const args: { projectId?: Id<'projects'>; status?: IssueStatus; limit: number } = { limit: 50 };
    if (selectedProjectId) args.projectId = selectedProjectId;
    if (issueStatusFilter !== 'all') args.status = issueStatusFilter;
    return args;
  }, [issueStatusFilter, selectedProjectId]);

  const issues = useQuery(convexQuery(api.issues.listIssues, dashboardView === 'issues' ? issueListArgs : 'skip'));

  const filteredIssues = useMemo(() => {
    const q = issueSearch.trim().toLowerCase();
    const items = issues.data ?? [];
    if (!q) return items;
    return items.filter((issue) => issue.title.toLowerCase().includes(q));
  }, [issueSearch, issues.data]);

  const issueContextId =
    routeIssueId && (dashboardView === 'issues' || dashboardView === 'time') ? routeIssueId : null;
  const selectedIssue = useQuery(
    convexQuery(
      api.issues.getIssue,
      issueContextId ? { issueId: issueContextId } : 'skip',
    ),
  );

  const selectedIssueComments = useQuery(
    convexQuery(
      api.issues.listIssueCommentsFlat,
      dashboardView === 'issues' && selectedIssueId ? { issueId: selectedIssueId, limit: 200 } : 'skip',
    ),
  );

  const activeTimer = useQuery(convexQuery(api.time.getActiveForViewer));
  const now = useNow(activeTimer.data ? 1_000 : null);

  const timeEntries = useQuery(
    convexQuery(api.time.listForViewer, dashboardView === 'time' && !timeIssueId ? { limit: 100 } : 'skip'),
  );
  const timeEntriesForIssue = useQuery(
    convexQuery(
      api.time.listForIssueForViewer,
      dashboardView === 'time' && timeIssueId ? { issueId: timeIssueId, limit: 100 } : 'skip',
    ),
  );
  const timeEntriesQuery = timeIssueId ? timeEntriesForIssue : timeEntries;
  const issueTimeEntries = useQuery(
    convexQuery(
      api.time.listForIssueForViewer,
      dashboardView === 'issues' && selectedIssueId ? { issueId: selectedIssueId, limit: 50 } : 'skip',
    ),
  );

  const unreadNotifications = useQuery(convexQuery(api.notifications.listForViewer, { unreadOnly: true, limit: 20 }));
  const latestNotifications = useQuery(convexQuery(api.notifications.listForViewer, { limit: 20 }));

  const userIdsForLookup = useMemo(() => {
    const ids = new Set<string>();

    for (const issue of filteredIssues) {
      ids.add(issue.creatorId);
      for (const assigneeId of issue.assigneeIds ?? []) ids.add(assigneeId);
    }

    const issue = selectedIssue.data;
    if (issue) {
      ids.add(issue.creatorId);
      for (const assigneeId of issue.assigneeIds ?? []) ids.add(assigneeId);
    }

    for (const comment of selectedIssueComments.data ?? []) {
      ids.add(comment.authorId);
    }

    for (const n of latestNotifications.data ?? []) {
      if (n.actorId) ids.add(n.actorId);
      if (n.userId) ids.add(n.userId);
    }

    if (viewer.data?.userId) ids.add(viewer.data.userId);

    return Array.from(ids);
  }, [filteredIssues, latestNotifications.data, selectedIssue.data, selectedIssueComments.data, viewer.data?.userId]);

  const users = useQuery(
    convexQuery(api.users.listByUserIds, userIdsForLookup.length ? { userIds: userIdsForLookup } : 'skip'),
  );

  const userById = useMemo(() => {
    const map = new Map<string, MinimalUser>();
    for (const user of users.data ?? []) {
      map.set(user.userId, {
        name: user.name,
        email: user.email,
        pictureUrl: user.pictureUrl,
      });
    }
    return map;
  }, [users.data]);

  const createProjectFn = useConvexMutation(api.projects.createProject);
  const createIssueFn = useConvexMutation(api.issues.createIssue);
  const setIssueStatusFn = useConvexMutation(api.issues.setIssueStatus);
  const setIssueAssigneesFn = useConvexMutation(api.issues.setIssueAssignees);
  const addIssueCommentFn = useConvexMutation(api.issues.addIssueComment);
  const startTimerFn = useConvexMutation(api.time.startTimer);
  const stopTimerFn = useConvexMutation(api.time.stopTimer);
  const markNotificationReadFn = useConvexMutation(api.notifications.markRead);

  const createProject = useMutation({
    mutationFn: (args: { name: string; description?: string; color?: string }) => createProjectFn(args),
    onSuccess: async (nextProjectId) => {
      navigate({ to: '/$projectId/$view', params: { projectId: nextProjectId, view: 'issues' } });
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const createIssue = useMutation({
    mutationFn: (args: {
      projectId?: Id<'projects'>;
      title: string;
      description?: string;
      estimateMinutes?: number;
      priority?: IssuePriority;
    }) => createIssueFn(args),
    onSuccess: async (issueId) => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
      navigate({
        to: '/$projectId/$view/$issueId',
        params: { projectId, view: 'issues', issueId },
      });
    },
  });

  const setIssueStatus = useMutation({
    mutationFn: (args: { issueId: Id<'issues'>; status: IssueStatus }) => setIssueStatusFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const setIssueAssignees = useMutation({
    mutationFn: (args: { issueId: Id<'issues'>; assigneeIds: string[] }) => setIssueAssigneesFn(args),
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

  const startTimer = useMutation({
    mutationFn: (args: { issueId?: Id<'issues'>; projectId?: Id<'projects'>; description?: string }) =>
      startTimerFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const stopTimer = useMutation({
    mutationFn: (args: { timeEntryId?: Id<'timeEntries'> }) => stopTimerFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const markNotificationRead = useMutation({
    mutationFn: (args: { notificationId: Id<'notifications'> }) => markNotificationReadFn(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });

  const [newProjectName, setNewProjectName] = useState('');
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDescription, setNewIssueDescription] = useState('');
  const [newIssueEstimate, setNewIssueEstimate] = useState('');
  const [newIssuePriority, setNewIssuePriority] = useState<IssuePriority>('medium');

  const [newCommentBody, setNewCommentBody] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<Id<'issueComments'> | null>(null);
  const [newTimerDescription, setNewTimerDescription] = useState('');

  useEffect(() => {
    if (dashboardView !== 'issues') return;
    if (!selectedIssueId) return;
    const stillVisible = filteredIssues.some((issue) => issue._id === selectedIssueId);
    if (stillVisible) return;
    navigate({ to: '/$projectId/$view', params: { projectId, view: 'issues' }, replace: true });
  }, [dashboardView, filteredIssues, navigate, selectedIssueId]);

  const selectedProject = selectedProjectId ? projectById.get(selectedProjectId) ?? null : null;

  const handleCreateProject = async (event: SubmitEvent) => {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;
    await createProject.mutateAsync({ name });
    setNewProjectName('');
  };

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
    });

    setNewIssueTitle('');
    setNewIssueDescription('');
    setNewIssueEstimate('');
    setNewIssuePriority('medium');
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

  const handleStartGeneralTimer = async (event: SubmitEvent) => {
    event.preventDefault();
    const description = newTimerDescription.trim();
    await startTimer.mutateAsync({ description: description.length ? description : undefined });
    setNewTimerDescription('');
  };

  const viewerId = viewer.data?.userId ?? null;

  const signedInUser = auth.user;
  const signedInName = signedInUser
    ? [signedInUser.firstName, signedInUser.lastName].filter(Boolean).join(' ').trim()
    : null;
  const signedInMinimalUser: MinimalUser | null = signedInUser
    ? {
        name: signedInName || null,
        email: signedInUser.email ?? null,
        pictureUrl: signedInUser.profilePictureUrl ?? null,
      }
    : null;

  const activeTimerElapsedMs =
    activeTimer.data && now ? Math.max(0, (activeTimer.data.endedAt ?? now) - activeTimer.data.startedAt) : null;

  const filteredTimeEntries = useMemo(() => {
    let items = timeEntriesQuery.data ?? [];

    if (timeViewFilter === 'running') {
      items = items.filter((entry) => entry.endedAt === null);
    } else if (timeViewFilter === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      const start = d.getTime();
      items = items.filter((entry) => entry.startedAt >= start);
    } else if (timeViewFilter === 'week') {
      const start = startOfLocalWeekMs();
      items = items.filter((entry) => entry.startedAt >= start);
    }

    if (dashboardView === 'time' && selectedProjectId && !timeIssueId) {
      items = items.filter((entry) => entry.projectId === selectedProjectId);
    }

    return items;
  }, [dashboardView, selectedProjectId, timeEntriesQuery.data, timeIssueId, timeViewFilter]);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="flex min-h-dvh">
        <Sidebar className="w-56">
          <SidebarHeader>
            <div className="bg-sidebar-accent text-sidebar-accent-foreground inline-flex size-7 items-center justify-center rounded-lg border border-sidebar-border/70">
              <RiHashtag className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">Issue → Invoice</div>
              <div className="truncate text-[0.625rem] text-muted-foreground">Linear-ish dashboard</div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={dashboardView === 'issues'}
                      onClick={() => {
                        if (issueIdParam) {
                          navigate({
                            to: '/$projectId/$view/$issueId',
                            params: { projectId, view: 'issues', issueId: issueIdParam },
                          });
                          return;
                        }

                        navigate({ to: '/$projectId/$view', params: { projectId, view: 'issues' } });
                      }}
                    >
                      <RiHashtag className="size-4 opacity-70" />
                      <span>Issues</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={dashboardView === 'time'}
                      onClick={() => {
                        if (issueIdParam) {
                          navigate({
                            to: '/$projectId/$view/$issueId',
                            params: { projectId, view: 'time', issueId: issueIdParam },
                          });
                          return;
                        }

                        navigate({ to: '/$projectId/$view', params: { projectId, view: 'time' } });
                      }}
                    >
                      <RiTimerLine className="size-4 opacity-70" />
                      <span>Time</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={dashboardView === 'invoices'}
                      onClick={() => navigate({ to: '/$projectId/$view', params: { projectId, view: 'invoices' } })}
                    >
                      <RiFileTextLine className="size-4 opacity-70" />
                      <span>Invoices</span>
                      <span className="ml-auto text-[0.625rem] text-muted-foreground">Soon</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Shortcuts</SidebarGroupLabel>
              <SidebarGroupContent>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => startTimer.mutate({})}
                  disabled={startTimer.isPending}
                >
                  <RiPlayLine className="size-4" />
                  Start timer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    if (!activeTimer.data) return;
                    stopTimer.mutate({ timeEntryId: activeTimer.data._id });
                  }}
                  disabled={stopTimer.isPending || !activeTimer.data}
                >
                  <RiStopLine className="size-4" />
                  Stop timer
                </Button>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <div className="flex items-center gap-2">
              <UserAvatar userId={signedInUser?.id ?? viewerId} user={signedInMinimalUser} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {signedInName || signedInUser?.email || (auth.loading ? 'Loading…' : 'Signed in')}
                </p>
                <p className="truncate text-[0.625rem] text-muted-foreground">
                  {viewerId ? shortId(viewerId) : signedInUser?.id ? shortId(signedInUser.id) : '…'}
                </p>
              </div>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => void auth.signOut({ returnTo: '/' })}
                title="Sign out"
              >
                <RiLogoutBoxLine />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <Sidebar className="w-72">
          {dashboardView === 'issues' ? (
            <>
              <SidebarHeader>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">Projects</p>
                  <p className="truncate text-[0.625rem] text-muted-foreground">
                    {(projects.data ?? []).length} total
                  </p>
                </div>
              </SidebarHeader>

              <SidebarContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={projectId === 'all'}
                      onClick={() => navigate({ to: '/$projectId/$view', params: { projectId: 'all', view: 'issues' } })}
                    >
                      All issues
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>

                <SidebarGroup>
                  <SidebarGroupLabel>Projects</SidebarGroupLabel>
                  <SidebarGroupContent>
                    {(projects.data ?? []).map((project) => {
                      const selected = selectedProjectId === project._id;
                      return (
                        <SidebarMenuButton
                          key={project._id}
                          isActive={selected}
                          onClick={() => navigate({ to: '/$projectId/$view', params: { projectId: project._id, view: 'issues' } })}
                          className="justify-between"
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span
                              className="size-2 rounded-full border border-sidebar-border/70"
                              style={{ backgroundColor: project.color ?? 'transparent' }}
                              aria-hidden
                            />
                            <span className="truncate">{project.name}</span>
                          </span>
                          <RiArrowRightSLine className="size-3.5 opacity-60" />
                        </SidebarMenuButton>
                      );
                    })}
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>New project</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <form onSubmit={handleCreateProject} className="flex items-center gap-2">
                      <Input
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="New project…"
                        aria-label="New project name"
                      />
                      <Button size="icon" variant="outline" disabled={createProject.isPending}>
                        <RiAddLine />
                      </Button>
                    </form>
                    {createProject.error ? (
                      <p className="mt-2 text-[0.625rem] text-destructive">Couldn’t create project.</p>
                    ) : null}
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </>
          ) : dashboardView === 'time' ? (
            <>
              <SidebarHeader>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">Time tracking</p>
                  <p className="truncate text-[0.625rem] text-muted-foreground">Your entries</p>
                </div>
              </SidebarHeader>

              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Views</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenuButton isActive={timeViewFilter === 'all'} onClick={() => setTimeViewFilter('all')}>
                      All entries
                    </SidebarMenuButton>
                    <SidebarMenuButton isActive={timeViewFilter === 'today'} onClick={() => setTimeViewFilter('today')}>
                      Today
                    </SidebarMenuButton>
                    <SidebarMenuButton isActive={timeViewFilter === 'week'} onClick={() => setTimeViewFilter('week')}>
                      This week
                    </SidebarMenuButton>
                    <SidebarMenuButton
                      isActive={timeViewFilter === 'running'}
                      onClick={() => setTimeViewFilter('running')}
                      disabled={!activeTimer.data}
                      className="justify-between"
                    >
                      <span>Running</span>
                      {activeTimer.data ? <Badge variant="secondary">1</Badge> : null}
                    </SidebarMenuButton>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </>
          ) : (
            <>
              <SidebarHeader>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">Invoices</p>
                  <p className="truncate text-[0.625rem] text-muted-foreground">Coming soon</p>
                </div>
              </SidebarHeader>

              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Views</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenuButton disabled>Drafts</SidebarMenuButton>
                    <SidebarMenuButton disabled>Sent</SidebarMenuButton>
                    <SidebarMenuButton disabled>Clients</SidebarMenuButton>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </>
          )}
        </Sidebar>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center gap-2 border-b border-border/60 px-4">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {dashboardView === 'issues'
                  ? selectedProject
                    ? selectedProject.name
                    : 'All issues'
                  : dashboardView === 'time'
                    ? 'Time tracking'
                    : 'Invoices'}
              </p>
              <p className="truncate text-[0.625rem] text-muted-foreground">
                {dashboardView === 'issues'
                  ? issueStatusFilter === 'all'
                    ? 'All statuses'
                    : labelForStatus(issueStatusFilter)
                  : dashboardView === 'time'
                    ? labelForTimeViewFilter(timeViewFilter)
                    : 'Coming soon'}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {dashboardView === 'issues' ? (
                <>
                  <div className="relative hidden w-64 items-center md:flex">
                    <RiSearchLine className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
                    <Input
                      value={issueSearch}
                      onChange={(e) => setIssueSearch(e.target.value)}
                      placeholder="Search issues…"
                      className="pl-7"
                    />
                  </div>

                  <Select
                    value={issueStatusFilter}
                    onValueChange={(value) => setIssueStatusFilter(value as IssueStatusFilter)}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <Separator className="my-1" />
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="icon" variant="outline" className="relative">
                      <RiNotification3Line />
                      {unreadNotifications.data?.length ? (
                        <span className="absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[0.625rem] text-primary-foreground">
                          {Math.min(9, unreadNotifications.data.length)}
                        </span>
                      ) : null}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-[22rem]">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <Separator className="my-1" />
                  {(latestNotifications.data ?? []).length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">No notifications yet.</div>
                  ) : null}
                  {(latestNotifications.data ?? []).map((n) => {
                    const actor = n.actorId ? userById.get(n.actorId) ?? null : null;
                    const isUnread = n.readAt === null;
                    return (
                      <DropdownMenuItem
                        key={n._id}
                        onClick={() => {
                          if (!isUnread) return;
                          markNotificationRead.mutate({ notificationId: n._id });
                        }}
                        className={cn('flex items-start gap-2', isUnread && 'bg-muted/30')}
                      >
                        <UserAvatar userId={n.actorId} user={actor} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-medium">{n.title}</span>
                            {isUnread ? <Badge variant="secondary">New</Badge> : null}
                          </div>
                          {n.body ? (
                            <p className="mt-0.5 line-clamp-2 text-[0.625rem] text-muted-foreground">{n.body}</p>
                          ) : null}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-2 py-1 md:flex">
                <RiTimerLine className="size-3.5 text-muted-foreground" />
                {activeTimer.data ? (
                  <>
                    <span className="max-w-[14rem] truncate text-xs">
                      {activeTimer.data.issueTitle ?? activeTimer.data.description ?? 'Timer running'}
                    </span>
                    <span className="text-[0.625rem] text-muted-foreground tabular-nums">
                      {activeTimerElapsedMs !== null ? formatDuration(activeTimerElapsedMs) : '…'}
                    </span>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => {
                        if (!activeTimer.data) return;
                        stopTimer.mutate({ timeEntryId: activeTimer.data._id });
                      }}
                      disabled={stopTimer.isPending}
                    >
                      <RiStopLine />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No timer</span>
                )}
              </div>
            </div>
          </header>

          {dashboardView === 'issues' ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_420px]">
            <div className="flex min-w-0 flex-col border-r border-border/60">
              <div className="border-b border-border/60 p-4">
                <form onSubmit={handleCreateIssue} className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={newIssueTitle}
                      onChange={(e) => setNewIssueTitle(e.target.value)}
                      placeholder="Create an issue…"
                      aria-label="Issue title"
                    />
                    <Select
                      value={newIssuePriority}
                      onValueChange={(value) => setNewIssuePriority(value as IssuePriority)}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={newIssueEstimate}
                      onChange={(e) => setNewIssueEstimate(e.target.value)}
                      placeholder="Est. (min)"
                      className="w-24"
                      inputMode="numeric"
                    />
                    <Button size="icon" disabled={createIssue.isPending}>
                      <RiAddLine />
                    </Button>
                  </div>
                  <Textarea
                    value={newIssueDescription}
                    onChange={(e) => setNewIssueDescription(e.target.value)}
                    placeholder="Description (optional)…"
                    className="min-h-20"
                  />
                  {createIssue.error ? (
                    <p className="text-[0.625rem] text-destructive">Couldn’t create issue.</p>
                  ) : null}
                </form>
              </div>

              <div className="min-h-0 overflow-auto">
                {issues.isLoading ? (
                  <div className="p-4 text-xs text-muted-foreground">Loading issues…</div>
                ) : null}

                {!issues.isLoading && filteredIssues.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground">No issues yet.</div>
                ) : null}

                <ul className="divide-y divide-border/60">
                  {filteredIssues.map((issue) => {
                    const selected = issue._id === selectedIssueId;
                    const projectName = issue.projectId ? (projectById.get(issue.projectId)?.name ?? 'Project') : null;
                    const estimate = issue.estimateMinutes ? formatEstimate(issue.estimateMinutes) : null;
                    return (
                      <li key={issue._id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (selected) {
                              navigate({ to: '/$projectId/$view', params: { projectId, view: 'issues' } });
                              return;
                            }
                            navigate({
                              to: '/$projectId/$view/$issueId',
                              params: { projectId, view: 'issues', issueId: issue._id },
                            });
                          }}
                          className={cn(
                            'flex w-full items-start gap-3 px-4 py-3 text-left text-xs transition-colors',
                            selected ? 'bg-muted/30' : 'hover:bg-muted/20',
                          )}
                        >
                          <span className="mt-0.5 text-muted-foreground" aria-hidden>
                            <StatusIcon status={issue.status} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">{issue.title}</span>
                              <PriorityPill priority={issue.priority} />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.625rem] text-muted-foreground">
                              {projectName ? <span className="truncate">{projectName}</span> : null}
                              <span className="tabular-nums">{timeAgo(issue.lastActivityAt, now ?? Date.now())}</span>
                              {estimate ? <Badge variant="outline">{estimate}</Badge> : null}
                            </div>
                          </div>

                          <div className="mt-0.5 flex items-center gap-2">
                            <AssigneeStack assigneeIds={issue.assigneeIds ?? []} userById={userById} />
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                startTimer.mutate({ issueId: issue._id });
                              }}
                              disabled={startTimer.isPending}
                              title="Start timer"
                            >
                              <RiPlayLine />
                            </Button>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="min-h-0 overflow-auto">
              <div className="border-b border-border/60 p-4">
                {selectedIssue.data ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{selectedIssue.data.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedIssue.data.projectId
                            ? projectById.get(selectedIssue.data.projectId)?.name ?? 'Project'
                            : 'No project'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigate({ to: '/$projectId/$view', params: { projectId, view: 'issues' } })}
                          title="Close"
                        >
                          <RiCloseLine />
                        </Button>
                        <Select
                          value={selectedIssue.data.status}
                          onValueChange={(value) => {
                            if (!selectedIssueId) return;
                            setIssueStatus.mutate({ issueId: selectedIssueId, status: value as IssueStatus });
                          }}
                        >
                          <SelectTrigger size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!selectedIssueId || !viewerId) return;
                            const issue = selectedIssue.data;
                            if (!issue) return;
                            const prev = issue.assigneeIds ?? [];
                            const next = prev.includes(viewerId)
                              ? prev.filter((id) => id !== viewerId)
                              : [...prev, viewerId];
                            setIssueAssignees.mutate({ issueId: selectedIssueId, assigneeIds: next });
                          }}
                          disabled={!viewerId || setIssueAssignees.isPending}
                        >
                          Assign to me
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => startTimer.mutate({ issueId: selectedIssueId ?? undefined })}
                          disabled={startTimer.isPending}
                          title="Start timer"
                        >
                          <RiPlayLine />
                        </Button>
                      </div>
                    </div>

                    {selectedIssue.data.description ? (
                      <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                        {selectedIssue.data.description}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{labelForPriority(selectedIssue.data.priority)}</Badge>
                      {selectedIssue.data.estimateMinutes ? (
                        <Badge variant="outline">{formatEstimate(selectedIssue.data.estimateMinutes)}</Badge>
                      ) : null}
                      <AssigneeStack assigneeIds={selectedIssue.data.assigneeIds ?? []} userById={userById} />
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
                    Select an issue to see details.
                  </div>
                )}
              </div>

              {selectedIssue.data ? (
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">Comments</p>
                    {replyToCommentId ? (
                      <button
                        type="button"
                        className="text-[0.625rem] text-muted-foreground hover:text-foreground"
                        onClick={() => setReplyToCommentId(null)}
                      >
                        Cancel reply
                      </button>
                    ) : null}
                  </div>

                  <CommentThread
                    comments={selectedIssueComments.data ?? []}
                    userById={userById}
                    onReply={(commentId) => setReplyToCommentId(commentId)}
                  />

                  <form onSubmit={handleAddComment} className="mt-3 grid gap-2">
                    <Textarea
                      value={newCommentBody}
                      onChange={(e) => setNewCommentBody(e.target.value)}
                      placeholder={replyToCommentId ? 'Write a reply…' : 'Write a comment…'}
                      className="min-h-20"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[0.625rem] text-muted-foreground">
                        {replyToCommentId ? 'Replying in thread' : 'Commenting on issue'}
                      </div>
                      <Button size="sm" disabled={addIssueComment.isPending}>
                        Post
                      </Button>
                    </div>
                    {addIssueComment.error ? (
                      <p className="text-[0.625rem] text-destructive">Couldn’t post comment.</p>
                    ) : null}
                  </form>

                  <Separator className="my-4" />

                  <p className="text-xs font-medium">Time entries (you)</p>
                  <div className="mt-2 grid gap-2">
                    {(issueTimeEntries.data ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No time entries for this issue yet.</p>
                    ) : null}
                    {(issueTimeEntries.data ?? []).slice(0, 10).map((entry) => {
                      const durationMs =
                        entry.endedAt === null ? (now ? now - entry.startedAt : null) : entry.endedAt - entry.startedAt;
                      return (
                        <div key={entry._id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/10 px-2 py-1.5 text-xs">
                          <div className="min-w-0">
                            <p className="truncate">{entry.description ?? 'Time entry'}</p>
                            <p className="truncate text-[0.625rem] text-muted-foreground">
                              {new Date(entry.startedAt).toLocaleString()}
                            </p>
                          </div>
                          <span className="text-[0.625rem] text-muted-foreground tabular-nums">
                            {durationMs === null ? '…' : formatDuration(Math.max(0, durationMs))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          ) : dashboardView === 'time' ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
              <div className="min-h-0 overflow-auto p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Entries</p>
                <div className="flex items-center gap-3">
                  {timeIssueId ? (
                    <button
                      type="button"
                      className="text-[0.625rem] text-muted-foreground hover:text-foreground"
                      onClick={() => navigate({ to: '/$projectId/$view', params: { projectId, view: 'time' } })}
                    >
                      Clear issue filter
                    </button>
                  ) : null}
                  <span className="text-[0.625rem] text-muted-foreground">
                    {timeEntriesQuery.isLoading ? 'Loading…' : `${filteredTimeEntries.length} shown`}
                  </span>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
                {timeEntriesQuery.isLoading ? (
                  <div className="p-4 text-xs text-muted-foreground">Loading time entries…</div>
                ) : null}
                {!timeEntriesQuery.isLoading && filteredTimeEntries.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground">No time entries yet.</div>
                ) : null}

                  <div className="divide-y divide-border/60">
                    {filteredTimeEntries.map((entry) => {
                      const durationMs =
                        entry.endedAt === null ? (now ? now - entry.startedAt : null) : entry.endedAt - entry.startedAt;
                      return (
                        <div key={entry._id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {entry.issueTitle ?? entry.projectName ?? entry.description ?? 'Time entry'}
                            </p>
                            <p className="mt-0.5 truncate text-[0.625rem] text-muted-foreground">
                              {new Date(entry.startedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.endedAt === null ? <Badge variant="secondary">Running</Badge> : null}
                            <span className="text-[0.625rem] text-muted-foreground tabular-nums">
                              {durationMs === null ? '…' : formatDuration(Math.max(0, durationMs))}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="border-l border-border/60 p-4">
                <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="text-xs font-medium">Active timer</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs">
                        {activeTimer.data?.issueTitle ?? activeTimer.data?.description ?? 'No timer running'}
                      </p>
                      <p className="truncate text-[0.625rem] text-muted-foreground tabular-nums">
                        {activeTimer.data && activeTimerElapsedMs !== null ? formatDuration(activeTimerElapsedMs) : '—'}
                      </p>
                    </div>
                    {activeTimer.data ? (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => stopTimer.mutate({ timeEntryId: activeTimer.data?._id })}
                        disabled={stopTimer.isPending}
                        title="Stop timer"
                      >
                        <RiStopLine />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <form onSubmit={handleStartGeneralTimer} className="mt-4 grid gap-2">
                  <p className="text-xs font-medium">Start a timer</p>
                  <Input
                    value={newTimerDescription}
                    onChange={(e) => setNewTimerDescription(e.target.value)}
                    placeholder="What are you working on?"
                  />
                  <Button size="sm" disabled={startTimer.isPending}>
                    <RiPlayLine className="size-4" />
                    Start timer
                  </Button>
                  {startTimer.error ? (
                    <p className="text-[0.625rem] text-destructive">Couldn’t start timer.</p>
                  ) : null}
                </form>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-6">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold">Invoices</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Coming soon. Tie issues + tracked time to clients, generate invoice drafts, and email them.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                    <p className="text-xs font-medium">Draft invoices</p>
                    <p className="mt-1 text-[0.625rem] text-muted-foreground">
                      Group time entries by client/project and review line items.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                    <p className="text-xs font-medium">Send via email</p>
                    <p className="mt-1 text-[0.625rem] text-muted-foreground">
                      Planned: Resend integration for sending invoices and reminders.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                    <p className="text-xs font-medium">Rates & clients</p>
                    <p className="mt-1 text-[0.625rem] text-muted-foreground">
                      Set hourly rates and map work to the right client.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                    <p className="text-xs font-medium">Audit trail</p>
                    <p className="mt-1 text-[0.625rem] text-muted-foreground">
                      Track changes to estimates, status, and assignments.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

type DashboardView = 'issues' | 'time' | 'invoices';
type IssueStatus = 'open' | 'in_progress' | 'done' | 'closed';
type IssueStatusFilter = IssueStatus | 'all';
type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
type TimeViewFilter = 'all' | 'today' | 'week' | 'running';
type MinimalUser = { name: string | null; email: string | null; pictureUrl: string | null };

function StatusIcon({ status }: { status: IssueStatus }) {
  const className = 'size-4';
  switch (status) {
    case 'open':
      return <RiCircleLine className={className} />;
    case 'in_progress':
      return <RiLoader4Line className={cn(className, 'animate-spin')} />;
    case 'done':
      return <RiCheckboxCircleLine className={className} />;
    case 'closed':
      return <RiCloseCircleLine className={className} />;
    default:
      return <RiCircleLine className={className} />;
  }
}

function PriorityPill({ priority }: { priority: IssuePriority }) {
  const label = labelForPriority(priority);
  const tone =
    priority === 'urgent'
      ? 'bg-destructive/15 text-destructive'
      : priority === 'high'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'bg-muted/40 text-muted-foreground';
  return <span className={cn('rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium', tone)}>{label}</span>;
}

function labelForPriority(priority: IssuePriority) {
  switch (priority) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
    case 'urgent':
      return 'Urgent';
    default:
      return priority;
  }
}

function labelForStatus(status: IssueStatus) {
  switch (status) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In progress';
    case 'done':
      return 'Done';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
}

function labelForTimeViewFilter(view: TimeViewFilter) {
  switch (view) {
    case 'all':
      return 'All entries';
    case 'today':
      return 'Today';
    case 'week':
      return 'This week';
    case 'running':
      return 'Running';
    default:
      return view;
  }
}

function startOfLocalWeekMs() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const daysSinceMonday = (day + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return Math.round(n);
}

function formatEstimate(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (Math.abs(hours - Math.round(hours)) < 1e-9) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1)}h`;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function timeAgo(timestampMs: number, nowMs: number) {
  const diffMs = nowMs - timestampMs;
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function shortId(id: string) {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function UserAvatar({
  userId,
  user,
}: {
  userId: string | null;
  user: { name: string | null; email: string | null; pictureUrl: string | null } | null;
}) {
  const label = user?.name ?? user?.email ?? userId ?? '?';
  const initials = getInitials(label);

  if (user?.pictureUrl) {
    return (
      <img
        src={user.pictureUrl}
        alt={label}
        className="size-7 shrink-0 rounded-full border border-border/60 object-cover"
      />
    );
  }

  return (
    <div className="bg-muted/40 text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-[0.625rem] font-medium">
      {initials}
    </div>
  );
}

function getInitials(label: string) {
  const parts = label.trim().split(/\s+/g).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

function AssigneeStack({
  assigneeIds,
  userById,
}: {
  assigneeIds: string[];
  userById: Map<string, { name: string | null; email: string | null; pictureUrl: string | null }>;
}) {
  if (!assigneeIds.length) {
    return <span className="text-[0.625rem] text-muted-foreground">Unassigned</span>;
  }

  const visible = assigneeIds.slice(0, 3);
  const rest = assigneeIds.length - visible.length;

  return (
    <div className="flex items-center">
      {visible.map((userId, index) => (
        <div key={userId} className={cn(index > 0 && '-ml-2')}>
          <UserAvatar userId={userId} user={userById.get(userId) ?? null} />
        </div>
      ))}
      {rest > 0 ? (
        <span className="ml-2 text-[0.625rem] text-muted-foreground">+{rest}</span>
      ) : null}
    </div>
  );
}

function CommentThread({
  comments,
  userById,
  onReply,
}: {
  comments: Array<{
    _id: Id<'issueComments'>;
    parentCommentId: Id<'issueComments'> | null;
    authorId: string;
    body: string;
    deletedAt: number | null;
    editedAt: number | null;
  }>;
  userById: Map<string, { name: string | null; email: string | null; pictureUrl: string | null }>;
  onReply: (commentId: Id<'issueComments'>) => void;
}) {
  const byParent = useMemo(() => {
    const map = new Map<string | null, typeof comments>();
    for (const c of comments) {
      const key = c.parentCommentId ?? null;
      const bucket = map.get(key) ?? [];
      bucket.push(c);
      map.set(key, bucket);
    }
    return map;
  }, [comments]);

  const render = (parentId: Id<'issueComments'> | null, depth: number) => {
    const bucket = byParent.get(parentId) ?? [];
    if (!bucket.length) return null;

    return (
      <div className={cn(depth > 0 && 'mt-2 border-l border-border/60 pl-3')}>
        {bucket.map((c) => {
          const author = userById.get(c.authorId) ?? null;
          return (
            <div key={c._id} className="mt-2 rounded-md border border-border/60 bg-muted/10 p-2">
              <div className="flex items-start gap-2">
                <UserAvatar userId={c.authorId} user={author} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-foreground">
                      {author?.name ?? author?.email ?? shortId(c.authorId)}
                    </p>
                    <button
                      type="button"
                      className="text-[0.625rem] text-muted-foreground hover:text-foreground"
                      onClick={() => onReply(c._id)}
                    >
                      Reply
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{c.body}</p>
                </div>
              </div>
              {render(c._id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return <div className="mt-2">{render(null, 0)}</div>;
}

function useNow(intervalMs: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!intervalMs) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
