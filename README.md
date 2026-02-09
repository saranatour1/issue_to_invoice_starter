# Issue → Invoice

Unify issues, time tracking, and invoicing in one app. Built with Convex, TanStack Start, and WorkOS AuthKit.

This is a [Convex](https://convex.dev/) project using WorkOS AuthKit for authentication.

After the initial setup (<2 minutes) you'll have a working full-stack app using:

- Convex as your backend (database, server logic)
- [React](https://react.dev/) as your frontend (web page interactivity)
- [TanStack Start](https://tanstack.com/start) for modern full-stack React with file-based routing
- [Tailwind](https://tailwindcss.com/) for building great looking accessible UI
- [WorkOS AuthKit](https://authkit.com/) for authentication

## Features

- **Projects**: Create projects and manage members (add/remove by email or user ID)
- **Issues**: List/board/table views with status, priority, estimates, labels, favorites, and links (blocked/related)
- **Collaboration**: Comments, reactions, and notifications
- **Time tracking**: Start/stop timers, filter time entries (running/today/this week), and track time per issue
- **Invoicing**: Build invoice drafts from tracked time, then save and manage invoices (saved/sent/paid/void)
- **Settings**: Profile preferences (name/timezone), default dashboard view, and issue view defaults
- **Public progress page**: `/progress` renders `progress.md` for easy stakeholder updates

## Tech stack

**In use**
- Backend: **Convex** (functions + database), `convex-helpers`, `@convex-dev/react-query`, `@convex-dev/rate-limiter`
- Auth: **WorkOS AuthKit**
- App: **React**, **TanStack Start**, **TanStack Router**, **TanStack React Query**
- UI: **Tailwind CSS**, **shadcn/ui** (Base UI), `class-variance-authority`, `clsx`, **Remix Icon**
- Data + utilities: **Zod**, **Luxon**
- Tooling: **TypeScript**, **Vite**, **ESLint**, **Prettier**

**Planned / optional**
- GitHub + Linear sync (issues/labels/links)
- Email sending (e.g. Resend)

## Project structure

- `src/routes`: TanStack Start routes (public + authenticated)
- `src/components/dashboard`: main app UI (issues, time, invoices, notifications, settings)
- `convex`: Convex schema + backend functions
- `progress.md`: public changelog source for `/progress`

## Get started

1. Clone this repository and install dependencies:

   ```bash
   npm install
   ```

2. Set up your environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

3. Configure WorkOS AuthKit:
   - Create a [WorkOS account](https://workos.com/)
   - Get your Client ID and API Key from the WorkOS dashboard
   - In the WorkOS dashboard, add `http://localhost:3000/callback` as a redirect URI
   - Generate a secure password for cookie encryption (minimum 32 characters)
   - Update your `.env.local` file with these values

4. Configure Convex:

   ```bash
   npx convex dev
   ```

   This will:
   - Set up your Convex deployment
   - Add your Convex URL to `.env.local`
   - Open the Convex dashboard

   Then set your WorkOS Client ID in Convex:

   ```bash
   npx convex env set WORKOS_CLIENT_ID <your_client_id>
   ```

   This allows Convex to validate JWT tokens from WorkOS

5. Run the development server:

   ```bash
   npm run dev
   ```

   This starts both the Vite dev server (TanStack Start frontend) and Convex backend in parallel

6. Open [http://localhost:3000](http://localhost:3000) to see your app

## Quick tour

- Create a project (Settings → Projects) and add members (by email or user ID).
- Create issues (and optional sub-issues), add labels, estimates, favorites, and links.
- Track time from the timer controls or within an issue.
- Create invoice drafts from tracked time, then save invoices and update status as you send/get paid.
- Share progress publicly via `/progress` (renders `progress.md`).

## Environment variables

- `.env.local` (app server):
  - `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_REDIRECT_URI`
  - `VITE_CONVEX_URL` (required)
  - `VITE_PUBLIC_SITE_URL` (optional, for absolute SEO/share URLs)
- Convex env:
  - `WORKOS_CLIENT_ID` (used server-side to validate WorkOS JWTs)

## Useful commands

- Dev: `npm run dev`
- Build: `npm run build`
- Start (after build): `npm run start`
- Lint/typecheck: `npm run lint`
- Format: `npm run format`

## WorkOS AuthKit Setup

This app uses WorkOS AuthKit for authentication. Key features:

- **Redirect-based authentication**: Users are redirected to WorkOS for sign-in/sign-up
- **Session management**: Automatic token refresh and session handling
- **Route loader protection**: Protected routes use loaders to check authentication
- **Client and server functions**: `useAuth()` for client components, `getAuth()` for server loaders

## Hosting & costs

This project is open source, and you can self-host it to avoid paying a hosting provider (i.e. running it on your own hosting service can make it “free” to operate from a hosting-fee perspective). Keep in mind you may still incur infrastructure costs and/or third-party service costs (for example Convex and WorkOS) depending on usage and plan.

## Contributing

Contributions are welcome!

1. Fork the repo and create a feature branch.
2. Install dependencies: `npm install`
3. Run the app locally: `npm run dev`
4. Before opening a PR:
   - Format: `npm run format`
   - Lint/typecheck: `npm run lint`
5. Open a PR with a clear description of the change and any screenshots/notes helpful for review.

By contributing, you agree that your contributions will be licensed under the MIT license.

## Learn more

To learn more about developing your project with Convex, check out:

- The [Tour of Convex](https://docs.convex.dev/get-started) for a thorough introduction to Convex principles.
- The rest of [Convex docs](https://docs.convex.dev/) to learn about all Convex features.
- [Stack](https://stack.convex.dev/) for in-depth articles on advanced topics.

## Join the community

Join thousands of developers building full-stack apps with Convex:

- Join the [Convex Discord community](https://convex.dev/community) to get help in real-time.
- Follow [Convex on GitHub](https://github.com/get-convex/), star and contribute to the open-source implementation of Convex.
