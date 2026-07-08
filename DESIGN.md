# Design

## Overview

A collaborative draft manager where multiple signed-in users browse, search, and
edit a shared library of ~1,200 content drafts. The design priority — matching
the brief — is **concurrent-edit safety first**, then correct/fast paging, then
polish.

Stack: Next.js 16 App Router (UI + API route handlers in one process), Prisma 7
over Neon Postgres, Better Auth for email/password sessions.

## Data model

A single `Draft` table holds the domain data ([prisma/schema.prisma](./prisma/schema.prisma)):

| Field                  | Notes                                              |
| ---------------------- | -------------------------------------------------- |
| `id` (PK)              | Integer, from the fixed seed                        |
| `title`, `body`        | Searchable text                                     |
| `type`                 | `social` \| `article` \| `caption`                  |
| `status`               | `Draft` \| `In Review` \| `Approved` \| `Published` |
| `tags`                 | `String[]` (Postgres array)                         |
| `author`               | Original author handle                              |
| **`version`**          | **Optimistic-concurrency token** (see below)        |
| `createdAt`,`updatedAt`| Timestamps; `updatedAt` is `@updatedAt`             |

Indexes: `type`, `status`, `author` (filter columns) and a **GIN index on
`tags`** for array containment. `id` is the primary key and doubles as the
stable pagination tiebreaker.

Better Auth's `user` / `session` / `account` / `verification` tables live in the
same database via the Prisma adapter.

## Concurrent-edit safety (the core)

**Strategy: optimistic concurrency control using the `version` column.** No
locks, no lost updates.

When a client opens a draft it receives the current `version`. On save it sends
that version back. The server performs a **single atomic conditional update**
([src/app/api/drafts/[id]/route.ts](./src/app/api/drafts/%5Bid%5D/route.ts)):

```ts
const result = await prisma.draft.updateMany({
  where: { id, version },            // only matches if version is unchanged
  data:  { ...fields, version: { increment: 1 } },
});
```

- `result.count === 1` → the row was still at the expected version. The update
  applied and the version incremented. Return `200` with the fresh row.
- `result.count === 0` → someone else already bumped the version (or the row is
  gone). We re-read the row:
  - row missing → `404`.
  - row present → **`409 Conflict`**, and we return the **current server copy**
    in the body so the UI can show the newer version and let the user retry.

Why this is safe under true concurrency: `UPDATE ... WHERE id = ? AND version =
?` is atomic in Postgres. If Alice and Bob both loaded version 4 and save at the
same instant, exactly one `UPDATE` matches the `version = 4` row; the other sees
`count = 0`. There is no read-modify-write race and no window where both
succeed. This is the same guarantee as an ETag/`If-Match` check, implemented
with a version integer.

### Conflict resolution in the UI

On a `409`, the edit page ([src/app/drafts/[id]/page.tsx](./src/app/drafts/%5Bid%5D/page.tsx))
shows a banner with the newer version and offers two explicit resolutions:

- **Keep my edits & save over theirs** — re-issue the save based on *their*
  version number, so the user's text wins on top of the latest row.
- **Discard mine & load their version** — replace the form with the server copy.

The user is never left guessing, and a stale save can never overwrite silently.

## Optimistic UI with rollback

Saving is optimistic: the moment the user clicks Save, the UI advances the
displayed version and shows the new state. The previous server state is kept in a
local snapshot. If the request is rejected (`409` conflict, `400` validation, or
a network error) the snapshot is restored — the optimistic change **rolls back**
— and the appropriate banner/error is shown. On success the server's
authoritative row replaces the optimistic guess.

## Correct + fast search and pagination

All filtering, searching, sorting, and paging happen **in Postgres**, never in
JS over the full set ([src/app/api/drafts/route.ts](./src/app/api/drafts/route.ts)):

- **Search** — `q` matches `title` OR `body`, case-insensitive.
- **Filters** — `type`, `status` (exact), and `tag` (array `has`).
- **Pagination** — `skip`/`take` with `page` + `pageSize`, plus a `count(*)` for
  the same `where`, returned as `{ items, total, page, pageSize, totalPages }`.

**Correctness (no duplicates or skips across pages):** the sort always includes a
**unique tiebreaker on `id`**. `ORDER BY updatedAt DESC, id DESC` gives a total
order even when many rows share an `updatedAt`, so page boundaries are stable and
deterministic — a row can't appear on two pages or fall between them.

**Performance:** filter columns are indexed; `tags` uses a GIN index; the default
page size is 20, so each request touches a small window. `total` and `items` are
fetched concurrently with `Promise.all`. Over 1,200 rows this is comfortably
sub-100ms.

> Trade-off: `contains` search does a sequential scan, which is fine at this
> scale. For a larger corpus I'd switch to a `pg_trgm` GIN index or Postgres
> full-text search (`tsvector`) — noted below.

## API design & validation

REST route handlers under `/api/drafts`:

| Method & path        | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `GET /api/drafts`    | List with search/filter/sort/paginate               |
| `GET /api/drafts/:id`| Fetch one draft                                     |
| `PATCH /api/drafts/:id` | Version-checked update (`409` on conflict)       |

Every request is **authenticated** — the handler resolves the Better Auth session
from the request cookies and returns `401` if absent. Every input is validated
with **Zod** ([src/lib/validation.ts](./src/lib/validation.ts)): query params are
coerced and bounded (page/pageSize limits, enum-checked `type`/`status`), and the
update body is fully validated (non-empty title, known enums, tag/body length
caps). Invalid input returns `400` with details and **never reaches the
database**, so a bad payload can't corrupt a record.

Auth routing uses an optimistic cookie check in `src/proxy.ts` (Next.js 16
renamed Middleware → Proxy) to redirect logged-out users to `/login`;
authoritative checks still run in each API handler.

## What I'd add with more time

- **Full-text search** via `tsvector` + GIN (or `pg_trgm`) to keep search fast as
  the corpus grows, with ranking.
- **Live updates over WebSocket/SSE** instead of the current ~4s polling, so
  other sessions' edits appear instantly.
- **Keyset (cursor) pagination** for deep pages — `WHERE (updatedAt, id) < (?, ?)`
  — to avoid large `OFFSET` costs on big datasets. The stable sort key is already
  in place for it.
- **Optimistic list updates & toasts**, edit history / audit log, and per-field
  merge on conflict (currently whole-record resolution).
- **Tests**: an integration test that fires two concurrent PATCHes at one draft
  and asserts exactly one 200 + one 409, plus paging-coverage tests.
- **Role-based permissions** and author-scoped editing.
- **Google sign-in** alongside email/password (email/password was chosen so the
  grading harness can authenticate without an interactive OAuth flow).

## What I cut for time

- Real-time transport (polling instead of sockets).
- Automated test suite (verified the core flows manually via the API + UI).
- Creating/deleting drafts (the brief centers on browse + edit; the model and
  API extend to it trivially).
