# LEGACY v2

Booking web app for **LEGACY**, a boutique movement studio in Abidjan (Pilates, Hot Mat
Pilates, Run Club). Members sign up, book and cancel classes, and join a waitlist when a
class is full; admins run the studio. Cash is paid at the studio and tracked with a
Paid / Not paid toggle — no online payments, memberships or credits.

This is a full rebuild of the original LEGACY app. Everything the original did still
works the same way; the improvements are listed in [CHANGELOG.md](CHANGELOG.md) and in
["What's new"](#whats-new-vs-the-original-legacy) below.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions with `useActionState`), TypeScript
- **PostgreSQL + Prisma 7** (`prisma-client` generator, `@prisma/adapter-pg`, `prisma.config.ts`)
- **Auth**: bcrypt password hashes + a signed HS256 JWT (`jose`) in an httpOnly cookie (7 days). No auth library.
- **Validation**: zod on every input boundary. **Styling**: one plain CSS file (`src/app/globals.css`), no Tailwind or UI kit.
- **Images**: sharp (resize/compress) + Vercel Blob (storage). **Tests**: Vitest (unit + concurrency), Playwright (e2e + axe).
- **Deploy**: Vercel + Vercel Marketplace Postgres (Prisma Postgres or Neon) + Vercel Blob.

## Local setup

Prerequisites: Node 22+, a PostgreSQL server (any recent version).

```bash
git clone <this repo> && cd claude_100
npm install                      # also runs `prisma generate`

cp .env.example .env             # then edit:
#   DATABASE_URL       -> your local Postgres (e.g. postgresql://postgres@127.0.0.1:5432/legacy)
#   TEST_DATABASE_URL  -> a second, empty database for the tests
#   SESSION_SECRET     -> any long random string (openssl rand -base64 32)
#   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD -> your first admin login

createdb legacy && createdb legacy_test   # or create them with your favourite tool

npm run db:migrate               # applies migrations (dev)
npm run db:seed                  # idempotent: only seeds when there are no users
npm run dev                      # http://localhost:3000
```

**Demo accounts after seeding**

| Who | Login | Password |
| --- | --- | --- |
| Admin | value of `SEED_ADMIN_EMAIL` | value of `SEED_ADMIN_PASSWORD` |
| Demo member | `demo@legacy.studio` (or phone `07 00 00 00 01`) | `legacy123` |
| 14 more members | `awa.kone@example.com`, `chloe.adou@example.com`, … | `legacy123` |

The seed also creates the 3 classes and 7 days of sessions at 07:00, 10:00 and 13:00
studio time (capacity 12, coaches Maya, Lina and Adam). Some are partly booked, one is
full with two people on its waitlist, so every screen has something to show.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build: env check → `prisma migrate deploy` → `prisma db seed` → `next build` |
| `npm start` | Serve the production build |
| `npm test` | Vitest unit + database tests (needs `TEST_DATABASE_URL`; migrations are applied automatically) |
| `npm run test:e2e` | Playwright smoke test + axe accessibility scan (starts the dev server if needed) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Run the idempotent seed |
| `npm run db:studio` | Open Prisma Studio |

### Tests

```bash
npm test            # 60+ unit/DB tests, including the booking concurrency tests
npm run test:e2e    # signup → book → cancel → waitlist promotion, plus WCAG scans
```

The non-negotiable test lives in `tests/unit/booking.test.ts`: two members book a
session with exactly one spot left *at the same time* and exactly one succeeds. The same
file also stress-tests 25 members racing for 3 spots, a member double-clicking Book, a
cancel racing a "Join waitlist", and includes a negative control that shows how a naive
read-then-write over-books — so the reason for the atomic `UPDATE` is never lost.

## Deploying to Vercel

1. **Import the repository** in Vercel (framework preset: Next.js — `vercel.json` already
   sets the build command to `npm run build`).
2. **Add a Postgres database** from the Vercel Marketplace (Storage → Create → *Prisma
   Postgres* or *Neon*) and connect it to the project. The integration injects the
   connection variables. The app picks the first usable `postgres://` URL among
   `DATABASE_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL`, `DATABASE_URL_UNPOOLED`,
   `POSTGRES_URL_NON_POOLING` — empty values and `prisma+postgres://` (Accelerate) URLs
   are skipped, because the pg driver adapter needs a plain TCP connection string.
   If your integration only provides an Accelerate URL, copy the *direct* connection
   string into `DATABASE_URL` yourself.
3. **Add a Blob store** (Storage → Create → *Blob*) and connect it. This sets
   `BLOB_READ_WRITE_TOKEN`, which enables member photo uploads.
4. **Set the remaining environment variables** (Project → Settings → Environment Variables):

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `DATABASE_URL` | yes* | *or one of the alternatives above, provided by the integration |
   | `SESSION_SECRET` | yes | `openssl rand -base64 32`. The build fails with a clear message if missing. |
   | `SEED_ADMIN_EMAIL` | yes (first deploy) | Your admin login; the seed only runs when the database has no users |
   | `SEED_ADMIN_PASSWORD` | yes (first deploy) | At least 6 characters |
   | `STUDIO_TIMEZONE` | no | IANA zone, default `Africa/Abidjan` |
   | `BLOB_READ_WRITE_TOKEN` | for photos | Set by the Blob integration |

5. **Deploy.** The build runs `prisma migrate deploy` and the idempotent seed before
   `next build`, so a fresh database is ready on the first deploy and later deploys only
   apply new migrations. `prisma generate` runs on `postinstall`.
6. Log in with the seed admin and create your real classes and sessions in `/admin`.
   To rotate the admin password later, change `SEED_ADMIN_PASSWORD` *before* the first
   deploy — the seed does not run again once users exist.

Tip: pick a Vercel region close to your database (Storage shows the database region)
to keep bookings snappy.

## How the code is organised

```
prisma/
  schema.prisma          data model (legacy models + waitlist fields, AuditLog, RateLimit)
  migrations/            SQL migrations (prisma migrate)
  seed.ts                idempotent seed
src/
  proxy.ts               auth guard (Next.js 16 "proxy", formerly middleware)
  app/                   routes — each folder is a URL
    (auth)/              /login, /register + their Server Actions
    schedule/ classes/ dashboard/ bookings/ profile/ sessions/[id]/members/  member pages
    avatar/[id]/route.ts login-gated photo endpoint with initials fallback
    admin/               overview, classes, sessions, members, bookings, audit + actions.ts
    globals.css          the one stylesheet (design tokens at the top)
  components/            small server/client components (forms, badges, nav, charts)
  lib/
    booking.ts           THE booking engine — read this first (see below)
    booking-actions.ts   Server Actions the member buttons call
    auth/                password hashing, JWT token, cookie session, safe return URLs
    rate-limit.ts        Postgres-backed fixed-window limits for login/register
    avatar.ts            validate → sharp → Vercel Blob (or local disk in dev)
    score.ts             LEGACY score and tiers
    time.ts              UTC <-> studio time with Intl
    env.ts               environment access; database URL picker
    admin/stats.ts       numbers and chart data for the admin overview
    audit.ts             audit log writer + wording
tests/
  unit/                  Vitest (runs against TEST_DATABASE_URL)
  e2e/                   Playwright smoke + axe
scripts/check-env.mjs    fails the build early when DATABASE_URL / SESSION_SECRET are missing
```

### The booking engine (`src/lib/booking.ts`)

The only place that changes `Session.bookedCount`. Rules:

- Taking a spot is one conditional `UPDATE "Session" SET "bookedCount" = "bookedCount" + 1
  WHERE id = $1 AND "bookedCount" < capacity AND "startsAt" > now` — never read-then-write.
  Under Postgres READ COMMITTED a blocked `UPDATE` re-checks its `WHERE` once the lock is
  released, so the loser updates 0 rows.
- Every write path locks the Session row first, then touches Booking rows (same order
  everywhere ⇒ no deadlocks). The unique index on `(userId, sessionId)` is the last line
  of defence against one member double-booking; a violation rolls back the whole
  transaction including the counter increment.
- Cancelling a confirmed booking (allowed until 2 hours before start, exactly 2h allowed)
  promotes the earliest waitlisted member **in the same transaction**; if nobody is
  waiting, the counter is decremented. The invariant `bookedCount == number of CONFIRMED
  bookings` is asserted in the tests.

## What's new vs. the original LEGACY

All six "Beyond legacy" items were built — see [CHANGELOG.md](CHANGELOG.md) for the
detail. In short: a waitlist with atomic auto-promotion and an in-app "You're in!"
banner; real image handling (sharp + Vercel Blob, content-sniffed uploads, ETag-served
avatars); a test suite that covers the concurrency risk plus an end-to-end smoke test
and axe scans; a smarter admin overview (attendance trend, busiest slots, cash to
collect); accessibility and PWA polish (AA contrast verified by test, focus states,
skip link, skeletons, manifest + icons); and basic abuse protection (Postgres-backed
rate limits, constant-time login failures, an admin audit log).

### Decisions made where the brief was open

- **Waitlist model**: a third `Booking.status` (`WAITLISTED`) rather than a separate
  table, so "one row per member per session" and "re-booking reuses the row" still hold.
  Leaving the waitlist is allowed until the session starts (the 2h rule is about spots).
- **LEGACY score** counts every CONFIRMED booking (10 points each), upcoming included,
  as the brief says "per confirmed session". Cancelling therefore lowers the score.
- **Private profiles** still show the member's name (the page needs a heading and the
  attendee list is a class roster) but hide the photo and details; the score is always
  public, as specified. Members see attendee photos only for public members.
- **Login by phone** accepts a local number (e.g. `07 00 00 00 01`) by also trying it
  behind the studio's default dial code (+225), since the login form has no country
  dropdown.
- **Admin capacity changes**: capacity cannot drop below the confirmed count; raising it
  promotes waitlisted members. Deleting a session removes its bookings (cascade) and is
  recorded in the audit log with the number of bookings removed.
- **Avatar privacy**: Blob URLs are random and never sent to the browser; `/avatar/[id]`
  proxies them (login required) so the "login required" rule holds even with Blob.
- **Colour**: the brief's slate `#7A8478` and clay `#B06A3A` only reach ~3.3:1 and ~3.7:1
  on the paper background, so body-size text uses darker variants (`--slate-text`,
  `--clay-text`); the originals remain for borders, large text and accents.
