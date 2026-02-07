# Progress Log

## 2026-02-07

### 1) Tracking setup
- Added this `progress.md` file to keep a simple running summary of new features and changes.
- Confirmed scope for this pass: new settings page, issue-view preferences, and project member management.

### 2) Convex data model + APIs
- Added persisted viewer preference fields (layout/filter/favorites defaults, profile preferences) to the user model.
- Added new user settings APIs: `getViewerSettings` and `updateViewerSettings`.
- Added project member management APIs: `projects.addMember` and `projects.removeMember`.
- Added a `users.by_email` index to support adding members by email as well as by user ID.

### 3) Settings page foundation
- Added a new authenticated route: `/$projectId/settings`.
- Added an in-app Settings panel with:
  - profile preferences (display name, timezone, weekly digest)
  - issue view defaults (default page, layout, status filter, favorites-only)
  - project people management (add/remove members)
  - embedded product progress preview
- Added Settings navigation in the app sidebar.

### 4) Public progress sharing
- Added a public `/progress` page that renders this `progress.md` file.
- Added “Progress” links on the landing page navigation and footer.

### 5) Preferences wiring + validation
- Issue page now initializes layout/filter/favorites defaults from saved viewer settings.
- Project root redirect (`/$projectId`) now respects your saved default page (issues/time/invoices/settings).
- Lint/typecheck pass clean after the changes.

### 6) Sidebar progress panel
- Added a dedicated **Updates** panel in the app sidebar.
- Added a **Progress log** action there that routes directly to `/progress`.
