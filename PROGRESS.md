# Progress

Living checklist. `x` = done, ` ` = todo. Grouped by slice.

## ✅ Design phase (locked)
- [x] Actors
- [x] User stories (Core/Later + NEVER guardrails)
- [x] Incident state machine
- [x] Data model / ER
- [x] API contract
- [x] Escalation flow
- [x] Design docs written from working code (`docs/`), incl. `decisions.md`

## ✅ Slice 1 — Backend walking skeleton (verified end-to-end)
- [x] Deps + `.env` + Postgres 17 + DB
- [x] Full v1 Prisma schema (8 models, 7 enums) + migration `init_v1`
- [x] Seed (1 team, 1 service, Alice/Bob rotation)
- [x] MailerService (Ethereal + stream fallback)
- [x] Incidents module — create / ack / resolve + reads (state machine)
- [x] Escalation scheduler (`@Interval 30s` → `runEscalations(now)`)
- [x] Escalation-timing test (`npm test`)
- [x] Live verify: create → email → escalate → ack → resolve; guardrails 409/403/400

## ⏳ Slice 2 — Frontend walking skeleton
- [ ] React + Vite app (list incidents, ack/resolve, timeline; manual refresh)
- [ ] Wire to the incidents API

## ⏳ Hardening (high-leverage, small)
- [ ] Atomic/idempotent escalation — conditional `updateMany` so overlapping
      poller runs can't double-escalate (see docs/technical-highlights.md)

## ⏳ v1 remaining slices
- [ ] Frontend walking skeleton (React+Vite: list, timeline, ack/resolve)
- [ ] **Organization + invites (multi-tenancy)** — B2B tenant boundary; invite
      users by email; org-scoped teams. Reframes the auth slice. (open decision —
      see docs/decisions.md → Known gaps)
- [ ] Auth: signup/login, JWT (replace `userId`-in-body), `GET /auth/me`
- [ ] Teams + membership CRUD (self-serve create → admin)
- [ ] Services CRUD (+ integration key)
- [ ] Rotation management (`PUT /teams/:id/rotation`, `GET .../oncall`)
- [ ] Webhook create endpoint (`POST /webhooks/incidents/:integrationKey`)
- [ ] Notification retry dispatcher (3× ~1 min on FAILED)
- [ ] Dashboard (active incidents + current on-call)
- [ ] Live updates via WebSocket
- [ ] Deploy to Railway (live URL)

## ⏳ v2 — the flagship layer
- [ ] Test coverage on the tricky paths · CI (lint+test+build)
- [ ] Health-check polling (auto-create incidents)
- [ ] Timezone-aware scheduling + overrides
- [ ] Analytics (MTTR, uptime %)
