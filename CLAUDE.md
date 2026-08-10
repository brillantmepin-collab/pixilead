# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm test             # vitest run (all unit tests)
npm run test:watch   # vitest watch mode
npx vitest run tests/unit/phone.test.ts        # single test file
npx vitest run -t "normalizes Cameroonian"     # single test by name
```

`npm run lint` is wired to `next lint` but no ESLint config file exists at the root, so it is not usable as-is.

Tests run in a `node` environment with `globals: true` and the `@/*` → repo-root alias mirrored from `tsconfig.json`. Only pure `lib/` helpers are covered (`phone`, `csv`, `mapper`); there are no component or route tests.

## What this is

PixiLead is a French-language B2B lead-generation SaaS for francophone Africa: scrape Google Maps business listings via Apify → store leads in Supabase → generate per-lead outreach messages with an LLM → export CSV / open WhatsApp deep links. Metered with a prepaid credit system, topped up through Moneroo (mobile money + card).

All user-facing copy, error strings, and even SQL comments are in **French**. Keep new strings in French.

## Database migrations

`lib/supabase/schema.sql` is the base schema; `lib/supabase/migrations/*.sql` layer on top. Both are idempotent — run them in Supabase's SQL editor, in order. A fresh install needs `schema.sql` then `001_credits_moneroo.sql`. There is no migration runner.

## Architecture

### The search lifecycle is poll-driven — there is no background worker

This is the single most important thing to understand:

1. `POST /api/searches` ([app/api/searches/route.ts](app/api/searches/route.ts)) validates input with Zod, inserts a `searches` row with `status: 'running'`, calls `apify.actor(...).start()` (fire-and-forget), stores `apify_run_id` / `apify_dataset_id`, and returns immediately.
2. [components/search/search-form.tsx](components/search/search-form.tsx) then polls `GET /api/searches/{id}/status` every 3 seconds.
3. **The status route is what actually ingests data** ([app/api/searches/[id]/status/route.ts](app/api/searches/[id]/status/route.ts)): when the Apify run reports `SUCCEEDED`, it pulls the dataset, maps it with `mapPlaceToLead`, upserts into `leads`, and flips the search to `succeeded`.

If nothing polls `/status`, leads are never persisted. Any change to ingestion belongs in the status route, not the POST route.

Idempotency comes from the `unique (search_id, place_id)` constraint plus `upsert(..., { onConflict: "search_id,place_id" })`.

### Auth is cookie-less; server identity comes from a Bearer token

Both [middleware.ts](middleware.ts) and [lib/supabase/client.ts](lib/supabase/client.ts) actively **delete every `sb-*` cookie** on each request / client construction. The browser client persists its session in `localStorage` under the key `pixilead_supabase_auth`. A plain non-HttpOnly cookie `pixilead_auth_session=true`, set by [app/login/page.tsx](app/login/page.tsx) and [app/auth/callback/route.ts](app/auth/callback/route.ts), is what the navbar reads to decide whether to render the logged-in state.

Consequence: `supabase.auth.getUser()` in a Server Component or route handler is **always null**. Don't "fix" a route by switching it to `createClient()` and expecting a user — you'd have to undo the cookie purge first.

Anything that needs a real server-side identity (credits, payments, exports) therefore goes through **`Authorization: Bearer <supabase access token>`**:

- Client side: [lib/supabase/auth-fetch.ts](lib/supabase/auth-fetch.ts) — `authFetch()` attaches the token, `readApiError()` normalizes 401 (`needsLogin`) vs 402 (`needsCredits`).
- Server side: [lib/auth.ts](lib/auth.ts) — `getAuthenticatedUser(request)` validates the JWT via `supabase.auth.getUser(token)`. It's a Supabase-signed token, so this is a genuine check, not a claim the client can forge.

This is why the CSV export downloads through `fetch` + a blob rather than `window.location.href` — a plain navigation can't carry the header.

Login auto-signs-up on `Invalid login credentials`, so there is no real distinction between sign-in and sign-up.

### Server data access bypasses RLS

[lib/supabase/server.ts](lib/supabase/server.ts) exports two clients:

- `createClient()` — cookie-backed SSR client (anon key). Used only by the auth callback. Because the session cookie is purged, RLS policies keyed on `auth.uid()` match nothing through this client — a read returns zero rows rather than leaking. That's what silently broke CSV export before it was moved to the admin client + explicit ownership check.
- `createAdminClient()` — service-role client. Used by the dashboard, the results page, and every ingestion / AI / credit / payment route.

Since the service-role client bypasses RLS entirely, **ownership must be checked in application code**. The credit and payment routes do this (`payment.user_id !== user.id` → 403). See the security note at the bottom for the routes that still don't.

### Credits and payments

Single balance on `profiles.credits`: **5 free at signup**, a search costs **3**, an AI message costs **1** (constants in [lib/credits.ts](lib/credits.ts)). `credits_search` / `credits_ai` are deprecated leftovers.

Every mutation goes through a Postgres RPC in [lib/supabase/migrations/001_credits_moneroo.sql](lib/supabase/migrations/001_credits_moneroo.sql), never a read-then-write from Node:

| RPC | Atomicity guarantee |
| --- | --- |
| `consume_credits_for` | `UPDATE … WHERE credits >= p_amount` — concurrent debits can't drive the balance negative. Returns the new balance, or NULL if refused. |
| `refund_credits_to` | Always granted; used when a scrape fails. |
| `grant_credits_for_payment` | Flips `payments` pending→completed **and** credits the balance in one transaction. The `WHERE status = 'pending'` guard is what makes webhook replays no-ops. |

These take an explicit `p_user_id` (the app calls them as service role, where `auth.uid()` is NULL), so they are `REVOKE`d from `anon`/`authenticated` and granted only to `service_role`. Keep it that way — an exposed `grant_credits_for_payment` would let anyone credit any account. `credit_transactions` is an append-only ledger; a partial unique index on `reference_id WHERE reason = 'purchase'` is the last-resort double-credit guard.

Debits happen in [app/api/searches/route.ts](app/api/searches/route.ts) (before launching Apify, refunded if the actor fails to start) and [app/api/leads/[id]/message/route.ts](app/api/leads/[id]/message/route.ts). Refund on a failed scrape lives in the status route, guarded by `.eq("status", "running").select()` so 3-second polling can't refund in a loop.

### Moneroo payment flow

Adapted from the `izisaas-payments-handler` skill, **single-merchant**: keys live in env, so the skill's AES-256-GCM `payment_connections` vault (a BYOK-marketplace concern) is deliberately absent.

```
/app/credits → POST /api/credits/checkout → insert payments row (pending)
                                          → moneroo /v1/payments/initialize
                                          → redirect to hosted checkout
                     ┌────────────────────────────────────────┘
                     ▼
   Moneroo → POST /api/webhooks/moneroo   (authoritative path)
   buyer   → /app/credits/retour?ref=<uuid> → polls GET /api/credits/payments/[id]  (fallback path)
```

The webhook ([app/api/webhooks/moneroo/route.ts](app/api/webhooks/moneroo/route.ts)) is ordered deliberately: raw body → HMAC verify → dedup → resolve payment → amount-tampering check → re-query Moneroo → grant. Things that will silently break it:

- Using `request.json()` instead of `request.text()`. The HMAC covers the **raw bytes**; re-serializing changes whitespace and key order and the signature never matches.
- Dropping `export const runtime = "nodejs"` — signature verification needs `node:crypto`.
- Moneroo sends no stable event id, so dedup hashes the raw body into `processed_events` (24h TTL, needs a cleanup job).

The return page is a **fallback, not the nominal path**: it re-queries Moneroo server-side with the secret key (which is authoritative, unlike the redirect's query params) so that late webhooks and local dev — where Moneroo can't reach your machine — still credit. Exactly-once still holds because both paths funnel into `grant_credits_for_payment`.

Currency follows `profiles.country` (CEMAC→XAF, UEMOA→XOF, RDC→USD). **XAF/XOF are zero-decimal** — the amount is whole francs, not centimes; USD prices are stored in cents. `isZeroDecimal()` in [lib/credits.ts](lib/credits.ts) is the single source of truth. Prices are always re-read server-side from the pack catalog; the client only ever sends a `packId`.

Moneroo quirks already handled in [lib/moneroo/client.ts](lib/moneroo/client.ts), don't undo them: `customer.first_name`/`last_name` are required (silent 400 otherwise), `metadata` values must be strings (422 otherwise), `description` is capped at 200 chars, there is no `cancel_url`, and a `200 OK` missing `data.id` or `data.checkout_url` is a failure.

### Everything degrades to demo data

Each external dependency has a placeholder fallback, so the app runs end to end with no credentials:

- **Supabase**: missing env → hardcoded `https://placeholder.supabase.co` + a fake JWT (both `lib/supabase/client.ts` and `server.ts`).
- **Apify**: `APIFY_TOKEN` missing or containing `"placeholder"` → the search is tagged `demo_run_<id>`, and the status route synthesizes leads from [lib/demo-data.ts](lib/demo-data.ts) instead of polling Apify.
- **OpenAI**: `OPENAI_API_KEY` missing or containing `"placeholder"` → the message route falls through to a hand-written per-channel template generator.
- **Results page**: `/app/recherches/{id}` renders demo leads when a search has no stored rows, and `/app/recherches/demo_landing` is a reserved id used by the landing page preview.
- **Moneroo**: `MONEROO_SECRET_KEY` missing or containing `"placeholder"` → `/api/credits/checkout` returns 503 rather than faking a purchase. Payments are the one thing that does **not** degrade to a demo.

The `"placeholder"` substring check is the actual gate, not just absence of the variable. When debugging "why am I getting fake data", check these spots before anything else.

Demo leads keep working without credits: `/api/leads/[id]/message` treats a **non-UUID** lead id as a demo fiche and returns a template message with no auth, no debit, and no DB write. Real (UUID) lead ids require auth and cost a credit.

### AI message generation

[app/api/leads/[id]/message/route.ts](app/api/leads/[id]/message/route.ts) builds a French prompt from the lead row, leaning on a "signal fort" heuristic (no website → opportunity angle; otherwise → rating/reviews angle), and asks OpenAI `gpt-4o-mini` for a **single** message as strict JSON (`{angle, subject?, text}`), varying by `channel` (whatsapp/email/sms) × `tone` × `messageType` chosen in [components/leads/message-modal.tsx](components/leads/message-modal.tsx).

Note the mismatch: `@anthropic-ai/sdk` is a dependency and [lib/ai/prompt.ts](lib/ai/prompt.ts) contains a `SYSTEM_PROMPT` for generating **three** tone variants — neither is imported anywhere. `.env.example` still lists `ANTHROPIC_API_KEY` while the code reads `OPENAI_API_KEY`. The Anthropic path is dead code from an earlier design.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APIFY_TOKEN
OPENAI_API_KEY            # NOT ANTHROPIC_API_KEY, despite the dependency
MONEROO_SECRET_KEY        # https://app.moneroo.io/developers/api-keys
MONEROO_WEBHOOK_SECRET    # https://app.moneroo.io/developers/webhooks
NEXT_PUBLIC_APP_URL       # public HTTPS base for Moneroo's return_url
```

Moneroo has no separate sandbox host — test vs live is decided by the key itself. Local development needs an HTTPS tunnel (ngrok / Cloudflare) for the webhook to arrive at all; without one, the return page's re-query is what credits the account.

## Conventions and gotchas

- **Phone numbers** ([lib/phone.ts](lib/phone.ts)) normalize to E.164 with a **hardcoded `+237` (Cameroon) default** for 9-digit locals, even though the search form offers seven countries. `getWhatsAppLink()` builds `wa.me/<digits>?text=<encoded>` links used by both the table and the CSV.
- **CSV export** ([lib/csv.ts](lib/csv.ts)) targets French Excel: `;` delimiter, UTF-8 BOM prefix, and phone fields prefixed with `'` to stop Excel mangling them. Headers are French. Don't switch to commas.
- **Search form filters are inert**: the three "Filtres ciblés" selects (website / phone / rating) have no state binding and are not sent to the API. Real filtering happens client-side afterwards in [components/leads/leads-table.tsx](components/leads/leads-table.tsx).
- **Styling** is Tailwind v4 (`@import "tailwindcss"` in [app/globals.css](app/globals.css)) with a forced dark emerald palette — hex colors like `#061a12`, `#0b1915`, `#122b22` are used inline throughout. Custom classes defined in `globals.css`: `glass-card`, `glass-card-hover`, `glow-emerald`, `glow-teal`, `text-gradient-emerald`, `stat-number`, `responsive-table-container`, `btn-magnetic`.
- Next.js 15 App Router: dynamic route `params` is a **Promise** and must be awaited in both pages and route handlers.
- Icons come from `lucide-react`; there is no component library.
- Client components broadcast balance changes with `window.dispatchEvent(new CustomEvent(CREDITS_EVENT, { detail: { balance } }))`; the navbar listens and updates without a refetch.

## Known security gap

The dashboard ([app/app/page.tsx](app/app/page.tsx)) and the results page ([app/app/recherches/[id]/page.tsx](app/app/recherches/[id]/page.tsx)) are Server Components reading through the service-role client with **no user filter** — `/app` lists the 10 most recent searches across *all* accounts, and any search id renders its leads to anyone. This predates the credit system but matters much more now that leads are paid for.

It can't be fixed by adding a `.eq("user_id", …)` alone: a Server Component can't read the `Authorization` header, so it has no identity to filter on. The two real options are to convert those pages to client components fetching through `authFetch`, or to restore cookie-based Supabase sessions (undoing the `sb-*` purge) so SSR and RLS work normally. The second is the better long-term fix and would let most routes drop the service-role client.
