# Executed Plan

The living design + execution plan this project was built from (originally an
internal plan file). Kept in-repo for the record.

**Execution status:** Design phase ✅ · Slice 1 (backend walking skeleton) ✅
built & verified · Slice 2 (these docs) ✅ · next: frontend / auth slice.
See [PROGRESS.md](../PROGRESS.md) for the live checklist.

---

## How we're working
Story-first and collaborative. Each layer is *derived from* the one above it and
signed off before we move on. The user decides at each step; the AI supplies
options + rationale and explains **why** each step exists. No layer is designed
ahead of the user's explicit input.

**Sequence:** Actors → User stories (Core/Later + NEVER guardrails) →
Incident state machine → Data model / ER → API contract → Escalation flow.

## Context
Deliberately-reset, self-owned build. `README.md` locks idea, scope, tech stack
(NestJS + Prisma + Postgres, React+Vite, Railway, **queue-free**), core loop,
walking skeleton, success metrics. Code state at plan time: bare greenfield
(empty `schema.prisma`, stock NestJS + Prisma module, no models, no migrations).
An earlier AI-authored data-model-first plan was scrapped — stories come first so
the model and API are derived, not guessed. `Olddocs/` is reference-only.

---

## Step 1 — Actors ✅
- **Human:** Admin, Responder, Viewer
- **Non-human:** Monitoring/Webhook source, System/Scheduler

The non-human actors add no scope — the webhook trigger and timer escalation are
already in the core loop; naming them makes the automated behaviors first-class
stories with their own NEVER guardrails, which is where escalation bugs hide.

## Step 2 — User stories ✅
Locked decisions (incident lifecycle): ack/resolve = any Responder/Admin on the
owning team; resolve may skip ack; webhook dedup = Later. Teams & membership:
self-serve team creation (creator → admin, no global role); multi-team with
per-team role on `Membership`. Full stories → [user-stories.md](./user-stories.md).

## Step 3 — Incident state machine ✅
TRIGGERED → ACKNOWLEDGED → RESOLVED (RESOLVED terminal). Edge decisions: empty
rotation → create unassigned + notify admins; ack transfers ownership; no de-ack.
Full transitions + guards → [incident-state-machine.md](./incident-state-machine.md).

## Step 4 — Data model / ER ✅
UUID PKs; first-class Notification table; rotation folded into Team; default
timeout 5m; no deletion in v1. 8 models, 7 enums, `idx(status,nextEscalationAt)`.
Full model → [data-model.md](./data-model.md).

## Step 5 — API contract ✅
Access-only JWT; action sub-resources (`/ack`, `/resolve`); offset pagination.
Full endpoint list → [api-contract.md](./api-contract.md).

## Step 6 — Escalation flow ✅
Queue-free via `nextEscalationAt` + interval poller (30s); first page inline;
retry 3× ~1 min (deferred). Full mechanism → [escalation-flow.md](./escalation-flow.md).

---

## Execution (reconciled with a remote "Ultraplan" refinement): BACKEND SLICE → DOCS → later slices

Reconciliation notes:
- **Environment corrected** — the Ultraplan profiled a Linux/Postgres-16 cloud
  container; the real machine is macOS/Postgres-17 with `.env` and `node_modules`
  already present. Its env steps were discarded.
- **Adopted from Ultraplan:** explicit `@relation` names; `tsx` for the seed;
  `MailerService` Ethereal + streamTransport fallback; `runEscalations(now)` as a
  plain testable method; the jest spec.
- **User decisions:** backend slice first, docs after (from working code); no
  React page this slice; no retry dispatcher this slice.

### Slice 1 — Backend walking skeleton ✅ (built & verified)
1. Deps (`@nestjs/schedule`, `nodemailer`, `tsx`), `.env` (drop stale `REDIS_URL`),
   Postgres up, DB ready.
2. Full v1 `schema.prisma` → `prisma migrate dev --name init_v1`.
3. `prisma/seed.ts` (1 team timeout=1m, 1 service, Alice/Bob rotation).
4. `src/mailer` (Ethereal + fallback), `src/incidents` (state machine +
   controller + DTOs), `src/escalation` (`@Interval 30s` → `runEscalations`).
5. Wire modules in `app.module.ts`.
6. `escalation.scheduler.spec.ts` (fake mailer, controlled clock) — `npm test`.
7. Verified live: create → inline email → 30s-poller escalation Alice→Bob → ack →
   resolve; timeline TRIGGERED→NOTIFIED→ESCALATED→ACKNOWLEDGED→RESOLVED;
   guardrails 409/403/400.

Necessary deviations found during build: `import 'dotenv/config'` in `main.ts` &
`seed.ts`; clean `rm -rf src/generated/prisma && prisma generate`; jest needs
`tsconfig.spec.json` (noEmit), a `.js` `moduleNameMapper`, and
`NODE_OPTIONS=--experimental-vm-modules`. Dropped the redundant
`GET /incidents/:id/events` (timeline is returned inline).

### Slice 2 — Docs from working code ✅
`docs/` — user-stories, incident-state-machine, data-model, api-contract,
escalation-flow, architecture, decisions (every decision + why + rejected
alternative), this plan; `PROGRESS.md`; README status + links.

### Later slices (deferred by decision)
React+Vite page · JWT auth · webhook create · team/service/rotation admin CRUD ·
notification retry dispatcher · WebSocket live updates · Railway deploy.

## Verification (Slice 1, local)
`brew services start postgresql@17` → `prisma migrate dev` → `prisma db seed` →
`npm test` (escalation spec passes) → `npm run start`; curl create → ack →
resolve, confirm timeline + guardrails; Ethereal preview URLs in the server log.
