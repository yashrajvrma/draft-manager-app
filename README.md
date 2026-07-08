# Draft Manager

A collaborative content-draft manager built for the WeSee full-stack task.
Several teammates can browse, search, and edit a shared library of ~1,200 AI
drafts at once — and **no edit is ever silently lost** when two people save the
same draft.

Stack: **Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 7 · Neon
Postgres · Better Auth**.

See [`DESIGN.md`](./DESIGN.md) for the data model, conflict strategy, and paging
approach.

## Prerequisites

- Node 20+ and `pnpm`
- A Postgres connection string (this project uses [Neon](https://neon.tech))

## Setup (one command)

1. Create `.env` in the project root:

   ```bash
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
   BETTER_AUTH_SECRET="any-long-random-string"
   BETTER_AUTH_URL="http://localhost:3000"
   ```

2. Install, then run the setup command — it generates the Prisma client,
   creates the tables, and seeds 1,200 drafts + two test users:

   ```bash
   pnpm install
   pnpm setup
   ```

3. Start the app:

   ```bash
   pnpm dev
   ```

   Open <http://localhost:3000>.

## Test accounts

| Email            | Password      |
| ---------------- | ------------- |
| `alice@test.com` | `password123` |
| `bob@test.com`   | `password123` |

## Try the concurrent-edit safety (the core feature)

1. Open the same draft in **two tabs** — e.g. one as Alice, one as Bob
   (use a second browser or an incognito window for the second login).
2. Edit and **Save** in tab 1 → succeeds, version bumps.
3. **Save** in tab 2 (still on the old version) → you get a **conflict banner**
   with the newer version and two choices: *keep my edits & save over theirs*,
   or *discard mine & load their version*. **Nothing is lost.**

The list page also polls every few seconds, so other sessions' changes appear
on their own.

## Scripts

| Command        | What it does                                        |
| -------------- | --------------------------------------------------- |
| `pnpm setup`   | `prisma generate` + `prisma db push` + seed         |
| `pnpm dev`     | Start the dev server                                |
| `pnpm build`   | Production build                                    |
| `pnpm db:seed` | Re-seed drafts + users (idempotent for users)       |
| `pnpm db:push` | Sync the Prisma schema to the database              |
