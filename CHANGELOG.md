# Changelog

All notable changes to LEGACY are documented here.

## [2.0.0] — LEGACY v2 (full rebuild)

A clone-and-improve rebuild on Next.js 16, Prisma 7 and Postgres. Everything in the
original LEGACY specification behaves as before (see "Preserved"); the items under
"Added" are the "Beyond legacy" improvements that were built on top.

### Added — Beyond legacy

1. **Waitlist with atomic auto-promotion**
   - Full sessions show **Join waitlist** instead of Book.
   - Cancelling a confirmed booking promotes the earliest waitlisted member to
     CONFIRMED *inside the same database transaction* that frees the spot, so the
     spot is never visible as free in between.
   - The promoted member sees a "You're in!" banner on their dashboard (in-app only,
     no email/SMS) and can dismiss it.
   - Joining the waitlist when a spot has just opened books the member directly.
   - Raising a session's capacity in admin promotes waitlisted members, earliest first.
   - Members can leave the waitlist at any time before the session starts.
   - Admin session view lists the waitlist in order and flags members who came
     "from waitlist".

2. **Real image handling**
   - Avatars are stored in Vercel Blob (never as bytes in Postgres). Local
     development falls back to `.data/avatars` on disk when no Blob token is set.
   - Uploads are checked by content (sharp), not just by declared MIME type — an SVG
     renamed to `.png` is rejected — then rotated (EXIF), cropped to a 512×512
     square and compressed to WebP before storing.
   - Photos are served through `/avatar/[id]` (login required) with ETag
     revalidation, and fall back to an initials SVG.

3. **Tests that cover the risk**
   - Vitest suite on a real Postgres database, including the mandatory concurrency
     test (two simultaneous attempts on the last spot — exactly one succeeds), a
     25-members-for-3-spots stress test, a same-member double-click test, a
     cancel-versus-join-waitlist race, the 2-hour cut-off boundary, and a negative
     control proving a naive read-then-write over-books.
   - One Playwright end-to-end smoke test: signup → book → cancel → waitlist
     promotion, plus an axe-core WCAG 2.1 A/AA scan of the public pages.
   - Unit tests for the time helpers, env picker, auth token/return-URL/phone
     handling, rate limiter (including concurrent hits), LEGACY score tiers and
     the colour-contrast of the design tokens.

4. **A smarter admin overview**
   - Attendance trend: confirmed bookings per class per day for the past and next
     7 days (stacked bars with a table view).
   - Busiest time slots: average fill rate per start hour.
   - "Cash to collect": count of unpaid confirmed bookings on upcoming sessions,
     linking to a new **Unpaid** filter on the bookings table.
   - Waitlist count.

5. **Accessibility and polish**
   - WCAG AA contrast verified by a test that reads the tokens from the stylesheet;
     darker slate/clay text variants are used wherever the brief's tones fall short.
   - Visible keyboard focus states, semantic landmarks, skip-to-content link,
     `aria-live` flash messages, labelled form fields with field-level errors.
   - Skeleton loading states on Schedule and Dashboard.
   - PWA installability: web manifest, maskable icons, theme colour, Apple touch
     icon. No offline booking — capacity data always comes live from the server.
   - Responsive tables (stacked cards on phones), no horizontal page scroll,
     `prefers-reduced-motion` respected.

6. **Basic abuse protection**
   - Postgres-backed fixed-window rate limits for login (per IP and per account)
     and registration (per IP); the account counter resets on a successful login.
   - Constant-time login failures (bcrypt runs against a dummy hash for unknown
     accounts) and a single generic error message.
   - Admin audit log recording who created/edited/archived classes, created/edited/
     deleted sessions and marked bookings paid/unpaid, with a dedicated
     **Audit log** page.

### Changed (implementation notes)

- The waitlist is modelled as a third `Booking.status` (`WAITLISTED`) with
  `waitlistedAt`, `promotedAt` and `promotionSeenAt` fields, so "one booking row per
  member per session" and "re-booking reuses the row" still hold.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`) are set for every response.
- Chart colours are brand-derived hues with enough chroma to be told apart under
  colour-vision deficiency; they are only used for chart marks, never for text.

### Preserved — legacy behaviour

Data model, registration/login rules, role redirects, safe return URLs, booking rules
(future sessions only, once, atomic conditional `UPDATE`, 2-hour cancellation window
with exactly 2h allowed, cancelled rows reused), studio-time display via `Intl`, all
member pages, LEGACY score and tiers, the admin feature set (admins cannot cancel
sessions), the idempotent seed, and the build/deploy contract.
