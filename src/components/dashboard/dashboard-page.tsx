import { useNavigate } from '@tanstack/react-router';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@workos/authkit-tanstack-react-start/client';
import {
  RiFileTextLine,
  RiHashtag,
  RiLogoutBoxLine,
  RiNotification3Line,
  RiPlayLine,
  RiSettings3Line,
  RiStopLine,
  RiTimerLine,
} from '@remixicon/react';

import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import type { CSSProperties, SubmitEvent } from 'react';
import type { EnrichedTimeEntry, MinimalUser } from '@/components/dashboard/issues/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { SettingsPanel } from '@/components/dashboard/settings-panel';
import { IssuesDashboard, IssuesDashboardContent } from '@/components/dashboard/issues/issues-dashboard';
import { IssuesSidebar } from '@/components/dashboard/issues/issues-sidebar';
import { UserAvatar } from '@/components/dashboard/issues/issue-ui';
import { useNow } from '@/hooks/use-now';
import { formatDuration, formatInteger, shortId } from '@/lib/dashboardFormat';
import { cn } from '@/lib/utils';

export type DashboardView = 'issues' | 'time' | 'invoices' | 'settings';

export type DashboardPageProps = {
  projectId: string;
  view: DashboardView;
  issueIdParam?: string | null;
};

export function DashboardPage({ projectId, view, issueIdParam = null }: DashboardPageProps) {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const navigate = useNavigate();

  const dashboardView = view;
  const routeIssueId = issueIdParam ? (issueIdParam as Id<'issues'>) : null;
  const timeIssueId = dashboardView === 'time' ? routeIssueId : null;
  const selectedProjectId: Id<'projects'> | null = projectId === 'all' ? null : (projectId as Id<'projects'>);

  const [timeViewFilter, setTimeViewFilter] = useState<TimeViewFilter>('all');
  const [newTimerDescription, setNewTimerDescription] = useState('');

  const upsertViewerFn = useConvexMutation(api.users.upsertViewer);
  useEffect(() => {
    void upsertViewerFn({}).catch(() => {});
  }, [upsertViewerFn]);

  const viewer = useQuery(convexQuery(api.users.getViewer, {}));
  const viewerId = viewer.data?.userId ?? null;

  const projects = useQuery(convexQuery(api.projects.listProjects, {}));
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return (projects.data ?? []).find((p) => p._id === selectedProjectId) ?? null;
  }, [projects.data, selectedProjectId]);

  const activeTimer = useQuery(convexQuery(api.time.getActiveForViewer));
  const now = useNow(activeTimer.data ? 1_000 : null);

  const startTimerFn = useConvexMutation(api.time.startTimer);
  const stopTimerFn = useConvexMutation(api.time.stopTimer);
  const markNotificationReadFn = useConvexMutation(api.notifications.markRead);

  const startTimer = useMutation({
    mutationFn: (args: { issueId?: Id<'issues'>; projectId?: Id<'projects'>; description?: string }) => startTimerFn(args),
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

  const activeTimerElapsedMs =
    activeTimer.data ? Math.max(0, (activeTimer.data.endedAt ?? now) - activeTimer.data.startedAt) : null;

  const unreadNotifications = useQuery(convexQuery(api.notifications.listForViewer, { unreadOnly: true, limit: 20 }));
  const latestNotifications = useQuery(convexQuery(api.notifications.listForViewer, { limit: 20 }));

  const notificationUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of latestNotifications.data ?? []) {
      if (n.actorId) ids.add(n.actorId);
      if (n.userId) ids.add(n.userId);
    }
    if (viewerId) ids.add(viewerId);
    return Array.from(ids);
  }, [latestNotifications.data, viewerId]);

  const notificationUsers = useQuery(
    convexQuery(api.users.listByUserIds, notificationUserIds.length ? { userIds: notificationUserIds } : 'skip'),
  );

  const notificationUserById = useMemo(() => {
    const map = new Map<string, MinimalUser>();
    for (const user of notificationUsers.data ?? []) {
      map.set(user.userId, { name: user.name, email: user.email, pictureUrl: user.pictureUrl });
    }
    return map;
  }, [notificationUsers.data]);

  const signedInUser = auth.user;
  const signedInName = signedInUser
    ? [signedInUser.firstName, signedInUser.lastName].filter(Boolean).join(' ').trim()
    : null;
  const signedInMinimalUser: MinimalUser | null = signedInUser
    ? {
        name: signedInName || null,
        email: signedInUser.email,
        pictureUrl: signedInUser.profilePictureUrl ?? null,
      }
    : null;

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

  const handleStartGeneralTimer = async (event: SubmitEvent) => {
    event.preventDefault();
    const description = newTimerDescription.trim();
    await startTimer.mutateAsync({ description: description.length ? description : undefined });
    setNewTimerDescription('');
  };

  const headerTitle =
    dashboardView === 'issues'
      ? selectedProject
        ? selectedProject.name
        : 'All issues'
      : dashboardView === 'time'
        ? 'Time tracking'
        : dashboardView === 'settings'
          ? 'Settings'
          : 'Invoices';

  const headerSubtitle =
    dashboardView === 'issues'
      ? 'Create issues, triage, and track progress'
      : dashboardView === 'time'
        ? labelForTimeViewFilter(timeViewFilter)
        : dashboardView === 'settings'
          ? 'Manage profile, view defaults, and project members'
          : 'Coming soon';

  const headerRight = (
    <div className="ml-auto flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon" variant="outline" className="relative">
              <RiNotification3Line />
              {unreadNotifications.data?.length ? (
                <span className="absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[0.625rem] text-primary-foreground">
                  {formatInteger(Math.min(9, unreadNotifications.data.length))}
                </span>
              ) : null}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-[22rem]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(latestNotifications.data ?? []).length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">No notifications yet.</div>
            ) : null}
            {(latestNotifications.data ?? []).map((n) => {
              const actor = n.actorId ? notificationUserById.get(n.actorId) ?? null : null;
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
                    {n.body ? <p className="mt-0.5 line-clamp-2 text-[0.625rem] text-muted-foreground">{n.body}</p> : null}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
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
              onClick={() => stopTimer.mutate({ timeEntryId: activeTimer.data._id })}
              disabled={stopTimer.isPending}
              title="Stop timer"
            >
              <RiStopLine />
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No timer</span>
        )}
      </div>
    </div>
  );

  const timeSidebar = (
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
              {activeTimer.data ? <Badge variant="secondary">{formatInteger(1)}</Badge> : null}
            </SidebarMenuButton>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );

  const settingsSidebar = (
    <>
      <SidebarHeader>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">Settings</p>
          <p className="truncate text-[0.625rem] text-muted-foreground">Preferences and project people</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sections</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenuButton onClick={() => document.getElementById('profile-settings')?.scrollIntoView({ behavior: 'smooth' })}>
              Profile settings
            </SidebarMenuButton>
            <SidebarMenuButton onClick={() => document.getElementById('issue-display-settings')?.scrollIntoView({ behavior: 'smooth' })}>
              Issue defaults
            </SidebarMenuButton>
            <SidebarMenuButton onClick={() => document.getElementById('projects-settings')?.scrollIntoView({ behavior: 'smooth' })}>
              Projects
            </SidebarMenuButton>
            <SidebarMenuButton onClick={() => document.getElementById('project-members-settings')?.scrollIntoView({ behavior: 'smooth' })}>
              Project people
            </SidebarMenuButton>
            <SidebarMenuButton onClick={() => document.getElementById('progress-log-settings')?.scrollIntoView({ behavior: 'smooth' })}>
              Product progress
            </SidebarMenuButton>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );

  const invoicesSidebar = (
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
  );

  const timeContent = (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
      <div className="min-h-0 overflow-auto p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Entries</p>
          <div className="flex items-center gap-3">
            {timeIssueId ? (
              <button
                type="button"
                className="text-[0.625rem] text-muted-foreground hover:text-foreground"
                onClick={() => navigate({ to: '/$projectId/time', params: { projectId } })}
              >
                Clear issue filter
              </button>
            ) : null}
            <span className="text-[0.625rem] text-muted-foreground">
              {timeEntriesQuery.isLoading ? 'Loading…' : `${formatInteger(filteredTimeEntries.length)} shown`}
            </span>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
          {timeEntriesQuery.isLoading ? <div className="p-4 text-xs text-muted-foreground">Loading time entries…</div> : null}
          {!timeEntriesQuery.isLoading && filteredTimeEntries.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No time entries yet.</div>
          ) : null}
          <div className="divide-y divide-border/60">
            {filteredTimeEntries.map((entry) => {
              const durationMs = entry.endedAt === null ? now - entry.startedAt : entry.endedAt - entry.startedAt;
              return (
                <div key={entry._id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {entry.issueTitle ?? entry.projectName ?? entry.description ?? 'Time entry'}
                    </p>
                    <p className="mt-0.5 truncate text-[0.625rem] text-muted-foreground">{new Date(entry.startedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.endedAt === null ? <Badge variant="secondary">Running</Badge> : null}
                    <span className="text-[0.625rem] text-muted-foreground tabular-nums">
                      {formatDuration(Math.max(0, durationMs))}
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
          <Button size="sm" disabled={startTimer.isPending} type="submit">
            <RiPlayLine className="size-4" />
            Start timer
          </Button>
          {startTimer.error ? <p className="text-[0.625rem] text-destructive">Couldn’t start timer.</p> : null}
        </form>
      </div>
    </div>
  );

  const invoicesContent = (
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
            <p className="mt-1 text-[0.625rem] text-muted-foreground">Set hourly rates and map work to the right client.</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
            <p className="text-xs font-medium">Audit trail</p>
            <p className="mt-1 text-[0.625rem] text-muted-foreground">Track changes to estimates, status, and assignments.</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <SidebarProvider style={{ ['--sidebar-width' as any]: '14rem' } as CSSProperties}>
        <Sidebar>
          <SidebarHeader className="h-12 flex-row items-center px-4 py-0">
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
                        if (dashboardView === 'issues' && routeIssueId) {
                          navigate({ to: '/$projectId/issues', params: { projectId } });
                          return;
                        }
                        if (routeIssueId) {
                          navigate({ to: '/$projectId/issues/$issueId', params: { projectId, issueId: routeIssueId } });
                          return;
                        }
                        navigate({ to: '/$projectId/issues', params: { projectId } });
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
                        if (dashboardView === 'time' && routeIssueId) {
                          navigate({ to: '/$projectId/time', params: { projectId } });
                          return;
                        }
                        if (routeIssueId) {
                          navigate({ to: '/$projectId/time/$issueId', params: { projectId, issueId: routeIssueId } });
                          return;
                        }
                        navigate({ to: '/$projectId/time', params: { projectId } });
                      }}
                    >
                      <RiTimerLine className="size-4 opacity-70" />
                      <span>Time</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={dashboardView === 'invoices'} onClick={() => navigate({ to: '/$projectId/invoices', params: { projectId } })}>
                      <RiFileTextLine className="size-4 opacity-70" />
                      <span>Invoices</span>
                      <span className="ml-auto text-[0.625rem] text-muted-foreground">Soon</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={dashboardView === 'settings'} onClick={() => navigate({ to: '/$projectId/settings', params: { projectId } })}>
                      <RiSettings3Line className="size-4 opacity-70" />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Shortcuts</SidebarGroupLabel>
              <SidebarGroupContent>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => startTimer.mutate({})} disabled={startTimer.isPending}>
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

            <SidebarGroup>
              <SidebarGroupLabel>Updates</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate({ to: '/progress' })}>
                      <RiFileTextLine className="size-4 opacity-70" />
                      <span>Progress log</span>
                      <Badge variant="secondary" className="ml-auto">
                        Public
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="flex-row items-center border-t border-sidebar-border/70 px-4 py-3">
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
              <Button size="icon-xs" variant="ghost" onClick={() => void auth.signOut({ returnTo: '/' })} title="Sign out">
                <RiLogoutBoxLine />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {dashboardView === 'issues' ? (
          <IssuesDashboard
            projectId={projectId}
            issueIdParam={issueIdParam}
            projects={projects.data ?? []}
            viewerId={viewerId}
            now={now}
            activeTimer={(activeTimer.data ?? null) as EnrichedTimeEntry | null}
            startTimer={startTimer}
            stopTimer={stopTimer}
          >
            <Sidebar collapsible="none" className="hidden w-72 border-r border-sidebar-border/70 md:flex">
              <IssuesSidebar />
            </Sidebar>

            <section className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-12 items-center gap-2 border-b border-border/60 px-4">
                <SidebarTrigger size="icon" variant="outline" title="Toggle sidebar" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{headerTitle}</p>
                  <p className="truncate text-[0.625rem] text-muted-foreground">{headerSubtitle}</p>
                </div>
                {headerRight}
              </header>

              <IssuesDashboardContent />
            </section>
          </IssuesDashboard>
        ) : (
          <>
            <Sidebar collapsible="none" className="hidden w-72 border-r border-sidebar-border/70 md:flex">
              {dashboardView === 'time' ? timeSidebar : dashboardView === 'settings' ? settingsSidebar : invoicesSidebar}
            </Sidebar>

            <section className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-12 items-center gap-2 border-b border-border/60 px-4">
                <SidebarTrigger size="icon" variant="outline" title="Toggle sidebar" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{headerTitle}</p>
                  <p className="truncate text-[0.625rem] text-muted-foreground">{headerSubtitle}</p>
                </div>
                {headerRight}
              </header>

              {dashboardView === 'time' ? timeContent : dashboardView === 'settings' ? <SettingsPanel projectId={projectId} /> : invoicesContent}
            </section>
          </>
        )}
      </SidebarProvider>
    </main>
  );
}

type TimeViewFilter = 'all' | 'today' | 'week' | 'running';

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
