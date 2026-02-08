import { Link } from '@tanstack/react-router';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiLoader4Line, RiSaveLine } from '@remixicon/react';

import { api } from '../../../convex/_generated/api';
import progressLog from '../../../progress.md?raw';
import type { Id } from '../../../convex/_generated/dataModel';
import type { FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type DashboardViewPreference = 'issues' | 'time' | 'invoices' | 'settings';
type IssueLayoutPreference = 'list' | 'board';
type IssueStatusPreference = 'all' | 'open' | 'in_progress' | 'done' | 'closed';

export function SettingsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const viewer = useQuery(convexQuery(api.users.getViewer, {}));
  const settings = useQuery(convexQuery(api.users.getViewerSettings, {}));
  const projects = useQuery(convexQuery(api.projects.listProjects, { includeArchived: false, limit: 200 }));

  const updateViewerSettingsFn = useConvexMutation(api.users.updateViewerSettings);
  const createProjectFn = useConvexMutation(api.projects.createProject);
  const addProjectMemberFn = useConvexMutation(api.projects.addMember);
  const removeProjectMemberFn = useConvexMutation(api.projects.removeMember);

  const [preferredName, setPreferredName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);
  const [defaultDashboardView, setDefaultDashboardView] = useState<DashboardViewPreference>('issues');
  const [issueLayoutPreference, setIssueLayoutPreference] = useState<IssueLayoutPreference>('list');
  const [issueStatusPreference, setIssueStatusPreference] = useState<IssueStatusPreference>('open');
  const [issueFavoritesOnlyPreference, setIssueFavoritesOnlyPreference] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const [newProjectName, setNewProjectName] = useState('');
  const [createProjectMessage, setCreateProjectMessage] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<Id<'projects'> | null>(null);

  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [projectMessage, setProjectMessage] = useState<string | null>(null);

  const [memberProjectId, setMemberProjectId] = useState<Id<'projects'> | null>(null);
  const availableProjects = projects.data ?? [];
  const defaultProjectFromRoute = projectId === 'all' ? null : (projectId as Id<'projects'>);

  useEffect(() => {
    if (!availableProjects.length) {
      setMemberProjectId(null);
      return;
    }

    if (memberProjectId && availableProjects.some((project) => project._id === memberProjectId)) {
      return;
    }

    if (defaultProjectFromRoute && availableProjects.some((project) => project._id === defaultProjectFromRoute)) {
      setMemberProjectId(defaultProjectFromRoute);
      return;
    }

    setMemberProjectId(availableProjects[0]?._id ?? null);
  }, [availableProjects, defaultProjectFromRoute, memberProjectId]);

  useEffect(() => {
    if (!settings.data || initialized) return;

    setPreferredName(settings.data.preferredName ?? '');
    setTimezone(settings.data.timezone ?? '');
    setWeeklyDigestEnabled(settings.data.weeklyDigestEnabled);
    setDefaultDashboardView(settings.data.defaultDashboardView);
    setIssueLayoutPreference(settings.data.issueLayoutPreference);
    setIssueStatusPreference(settings.data.issueStatusFilterPreference);
    setIssueFavoritesOnlyPreference(settings.data.issueFavoritesOnlyPreference);
    setInitialized(true);
  }, [initialized, settings.data]);

  const saveViewerSettings = useMutation({
    mutationFn: updateViewerSettingsFn,
  });
  const createProject = useMutation({
    mutationFn: (args: { name: string; description?: string; color?: string }) => createProjectFn(args),
    onSuccess: async (nextProjectId) => {
      setCreatedProjectId(nextProjectId);
      setCreateProjectMessage('Project created.');
      await queryClient.invalidateQueries({ queryKey: ['convexQuery'] });
    },
  });
  const addProjectMember = useMutation({
    mutationFn: addProjectMemberFn,
  });
  const removeProjectMember = useMutation({
    mutationFn: removeProjectMemberFn,
  });

  const selectedProject = useMemo(
    () => availableProjects.find((project) => project._id === memberProjectId) ?? null,
    [availableProjects, memberProjectId],
  );

  const memberUsers = useQuery(
    convexQuery(
      api.users.listByUserIds,
      selectedProject ? { userIds: selectedProject.memberIds.slice(0, 200) } : 'skip',
    ),
  );

  const memberUserById = useMemo(() => {
    const map = new Map<string, { name: string | null; email: string | null; pictureUrl: string | null }>();
    for (const user of memberUsers.data ?? []) {
      map.set(user.userId, {
        name: user.name,
        email: user.email,
        pictureUrl: user.pictureUrl,
      });
    }
    return map;
  }, [memberUsers.data]);

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSettingsMessage(null);
    try {
      await saveViewerSettings.mutateAsync({
        preferredName: preferredName.trim() ? preferredName.trim() : null,
        timezone: timezone.trim() ? timezone.trim() : null,
        weeklyDigestEnabled,
      });
      setSettingsMessage('Profile settings saved.');
    } catch {
      setSettingsMessage('Could not save profile settings.');
    }
  };

  const handleSaveIssuePreferences = async (event: FormEvent) => {
    event.preventDefault();
    setSettingsMessage(null);
    try {
      await saveViewerSettings.mutateAsync({
        defaultDashboardView,
        issueLayoutPreference,
        issueStatusFilterPreference: issueStatusPreference,
        issueFavoritesOnlyPreference,
      });
      setSettingsMessage('Issue view defaults saved.');
    } catch {
      setSettingsMessage('Could not save issue defaults.');
    }
  };

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    setCreateProjectMessage(null);
    setCreatedProjectId(null);
    const name = newProjectName.trim();
    if (!name) return;
    try {
      await createProject.mutateAsync({ name });
      setNewProjectName('');
    } catch {
      setCreateProjectMessage('Could not create project.');
    }
  };

  const handleAddMember = async (event: FormEvent) => {
    event.preventDefault();
    setProjectMessage(null);
    if (!selectedProject || !memberIdentifier.trim()) return;

    try {
      const result = await addProjectMember.mutateAsync({
        projectId: selectedProject._id,
        identifier: memberIdentifier.trim(),
      });
      setMemberIdentifier('');
      setProjectMessage(result.added ? 'Member added to project.' : 'Member is already in this project.');
    } catch {
      setProjectMessage('Could not add member. Use an existing user email or user ID.');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setProjectMessage(null);
    if (!selectedProject) return;
    try {
      const result = await removeProjectMember.mutateAsync({ projectId: selectedProject._id, userId });
      setProjectMessage(result.removed ? 'Member removed from project.' : 'Member was not in this project.');
    } catch {
      setProjectMessage('Could not remove member.');
    }
  };

  const viewerLabel = viewer.data?.name || viewer.data?.email || viewer.data?.userId || 'Signed in user';

  return (
    <div className="h-full flex-1 overflow-auto p-4 w-full">
      <div className="mx-auto grid w-full  gap-4">
        <Card id="profile-settings" className='w-full'>
          <CardHeader>
            <CardTitle>Profile settings</CardTitle>
            <CardDescription>Manage your account preferences for this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="settings-profile-display">Display name</Label>
                <Input
                  id="settings-profile-display"
                  value={preferredName}
                  onChange={(event) => setPreferredName(event.target.value)}
                  placeholder={viewerLabel}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="settings-profile-timezone">Timezone</Label>
                <Input
                  id="settings-profile-timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="America/New_York"
                />
              </div>

              <label
                htmlFor="settings-weekly-digest"
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
              >
                <input
                  id="settings-weekly-digest"
                  type="checkbox"
                  checked={weeklyDigestEnabled}
                  onChange={(event) => setWeeklyDigestEnabled(event.target.checked)}
                  className="size-4"
                />
                <span className="text-xs">Email me a weekly activity digest.</span>
              </label>

              <div className="flex items-center gap-2">
                <Button size="sm" type="submit" disabled={saveViewerSettings.isPending}>
                  {saveViewerSettings.isPending ? <RiLoader4Line className="animate-spin" /> : <RiSaveLine />}
                  Save profile
                </Button>
                {settingsMessage ? <span className="text-[0.625rem] text-muted-foreground">{settingsMessage}</span> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card id="issue-display-settings">
          <CardHeader>
            <CardTitle>Issue view defaults</CardTitle>
            <CardDescription>Choose how issue pages should open by default.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveIssuePreferences} className="grid gap-3">
              <div className="grid gap-1.5 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Default page</Label>
                  <Select value={defaultDashboardView} onValueChange={(value) => setDefaultDashboardView(value as DashboardViewPreference)}>
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="issues">Issues</SelectItem>
                      <SelectItem value="time">Time</SelectItem>
                      <SelectItem value="invoices">Invoices</SelectItem>
                      <SelectItem value="settings">Settings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label>Issue layout</Label>
                  <Select value={issueLayoutPreference} onValueChange={(value) => setIssueLayoutPreference(value as IssueLayoutPreference)}>
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="list">List</SelectItem>
                      <SelectItem value="board">Board</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5 sm:max-w-xs">
                <Label>Default issue filter</Label>
                <Select value={issueStatusPreference} onValueChange={(value) => setIssueStatusPreference(value as IssueStatusPreference)}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label
                htmlFor="settings-favorites-only"
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
              >
                <input
                  id="settings-favorites-only"
                  type="checkbox"
                  checked={issueFavoritesOnlyPreference}
                  onChange={(event) => setIssueFavoritesOnlyPreference(event.target.checked)}
                  className="size-4"
                />
                <span className="text-xs">Open issue page with favorites-only enabled.</span>
              </label>

              <div className="flex items-center gap-2">
                <Button size="sm" type="submit" disabled={saveViewerSettings.isPending}>
                  {saveViewerSettings.isPending ? <RiLoader4Line className="animate-spin" /> : <RiSaveLine />}
                  Save issue defaults
                </Button>
                {settingsMessage ? <span className="text-[0.625rem] text-muted-foreground">{settingsMessage}</span> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card id="projects-settings">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Create projects and jump to their issue pages.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <form onSubmit={handleCreateProject} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="New project name"
              />
              <Button type="submit" variant="outline" disabled={createProject.isPending || !newProjectName.trim()}>
                {createProject.isPending ? <RiLoader4Line className="animate-spin" /> : <RiAddLine />}
                Create
              </Button>
            </form>

            {createProjectMessage ? (
              <div className="text-[0.625rem] text-muted-foreground">
                {createProjectMessage}{' '}
                {createdProjectId ? (
                  <Link to="/$projectId/issues" params={{ projectId: createdProjectId }} className="text-primary underline underline-offset-4">
                    Open issues
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-md border border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                <p className="text-xs font-medium">All projects</p>
                <Badge variant="outline">{availableProjects.length} total</Badge>
              </div>
              <div className="divide-y divide-border/60">
                {availableProjects.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No projects yet.</div>
                ) : null}
                {availableProjects.map((project) => (
                  <div key={project._id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{project.name}</p>
                      <p className="truncate text-[0.625rem] text-muted-foreground">{project.description ?? project._id}</p>
                    </div>
                    <Link
                      to="/$projectId/issues"
                      params={{ projectId: project._id }}
                      className="text-[0.625rem] text-primary underline underline-offset-4"
                    >
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="project-members-settings">
          <CardHeader>
            <CardTitle>Project people</CardTitle>
            <CardDescription>Add or remove project members by email or user ID.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5 sm:max-w-sm">
              <Label>Project</Label>
              <Select
                value={memberProjectId ?? undefined}
                onValueChange={(value) => setMemberProjectId(value as Id<'projects'>)}
                disabled={!availableProjects.length}
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder={availableProjects.length ? 'Select project' : 'No projects yet'} />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.map((project) => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <form onSubmit={handleAddMember} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={memberIdentifier}
                onChange={(event) => setMemberIdentifier(event.target.value)}
                placeholder="user@email.com or auth user ID"
                disabled={!selectedProject}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={!selectedProject || addProjectMember.isPending || !memberIdentifier.trim()}
              >
                {addProjectMember.isPending ? <RiLoader4Line className="animate-spin" /> : <RiAddLine />}
                Add member
              </Button>
            </form>

            {selectedProject ? (
              <div className="rounded-md border border-border/60">
                <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                  <p className="text-xs font-medium">{selectedProject.name}</p>
                  <Badge variant="outline">{selectedProject.memberIds.length} members</Badge>
                </div>
                <div className="divide-y divide-border/60">
                  {selectedProject.memberIds.map((memberId) => {
                    const member = memberUserById.get(memberId);
                    const label = member?.name || member?.email || memberId;
                    const isOwner = selectedProject.creatorId === memberId;
                    return (
                      <div key={memberId} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{label}</p>
                          <p className="truncate text-[0.625rem] text-muted-foreground">{member?.email || memberId}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOwner ? <Badge variant="secondary">Owner</Badge> : null}
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleRemoveMember(memberId)}
                            disabled={removeProjectMember.isPending || isOwner}
                            title="Remove member"
                          >
                            <RiDeleteBinLine />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Create a project first to manage members.</p>
            )}

            {projectMessage ? <p className="text-[0.625rem] text-muted-foreground">{projectMessage}</p> : null}
          </CardContent>
        </Card>

        <Card id="progress-log-settings">
          <CardHeader>
            <CardTitle>Product progress</CardTitle>
            <CardDescription>Live snapshot from the repository progress log.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="text-xs text-muted-foreground">
              Share publicly at{' '}
              <Link to="/progress" className="text-primary underline underline-offset-4">
                /progress
              </Link>
              .
            </div>
            <pre
              className={cn(
                'max-h-72 overflow-auto rounded-md border border-border/60 bg-muted/20 p-3 text-[0.625rem] leading-relaxed',
              )}
            >
              {progressLog}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
