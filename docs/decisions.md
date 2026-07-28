# Decision Log

Every business-logic and engineering decision behind PagerDuty Lite, each with
**why** it was made and the **alternative that was rejected**. These were made
deliberately (options weighed at each step), not defaulted — this doc is what
makes the project defensible in a review.

---

## Product / business-logic

### Ack & resolve are team-wide, not assignee-only
- **Decision:** any Responder/Admin on the owning team can ack/resolve — a
  membership check, not an assignment check.
- **Why:** deadlock-proof for a small team — if the paged person is unreachable,
  a teammate can still act. Simpler auth.
- **Rejected:** assignee-only (real PagerDuty "this page is yours"). More
  accountability, but if the assignee is asleep nobody else can ack — you'd wait
  for escalation.

### Resolve may skip acknowledge
- **Decision:** `TRIGGERED → RESOLVED` is legal (so is `ACKNOWLEDGED → RESOLVED`).
- **Why:** a quick fix shouldn't force a pointless ack click.
- **Rejected:** mandatory `ack → resolve`. Cleaner audit trail, but friction on
  trivial incidents.

### Ack transfers ownership to the acker
- **Decision:** on ack, `assignedUserId` becomes whoever acked.
- **Why:** because ack is team-wide, the acker may differ from the target; "I've
  got this" should make it visibly theirs.
- **Rejected:** keep the original assignee — leaves ownership ambiguous.

### Empty rotation → create unassigned + notify admins
- **Decision:** an incident for a team with no rotation is still created,
  unassigned, and the team's admins are notified.
- **Why:** never drop an alert — the whole point of the tool.
- **Rejected:** reject creation (throws away a real alert over incomplete setup);
  create silently (nobody told).

### RESOLVED is terminal
- **Decision:** no reopen in v1; recurrence = a new incident.
- **Why:** keeps the state machine simple; matches the README.
- **Rejected:** reopenable — adds re-notification and "why did this reopen" audit
  complexity for little v1 value.

### Webhook dedup deferred
- **Decision:** every alert creates a new incident in v1 (no dedup key).
- **Why:** dedup matching + partial-unique logic isn't worth it for a portfolio v1.
- **Rejected:** dedup now — meaningful extra complexity in the Incident model.

### Self-serve team creation
- **Decision:** any signed-up user can create a team and becomes its admin.
- **Why:** no global/superadmin role needed; admin is always per-team; realistic
  for self-serve SaaS.
- **Rejected:** a global superadmin creates teams — extra role, seeded admin,
  more auth surface.

### Multi-team membership, per-team role
- **Decision:** a user can belong to many teams with a different role each; role
  lives on `Membership`.
- **Why:** matches the README (dashboard shows on-call *per team*); realistic.
- **Rejected:** one team per user with a global role — simpler, but needs rework
  for any cross-team use.

### Severity + viewer role in v1
- **Decision:** P1/P2/P3 severity and a read-only Viewer role are in v1.
- **Why:** both are cheap (one field / one role check) and expected of the domain.
- **Rejected:** deferring them — they carry their weight already.

---

## Data model

### UUID primary keys
- **Decision:** UUID PKs on every table.
- **Why:** not enumerable (no `/incidents/1,2,3` probing), safe in URLs, no
  collision on concurrent inserts.
- **Rejected:** auto-increment ints — smaller/readable but enumerable and leak counts.

### First-class Notification table
- **Decision:** each notification is a row with `status` + `attempts`.
- **Why:** it's what makes queue-free in-process retry possible — you can't retry
  a failure you didn't record.
- **Rejected:** fire-and-forget + a timeline event — simpler, but no retry
  (contradicts the retry decision).

### Rotation folded into Team
- **Decision:** no separate `OnCallRotation` entity; timeout on `Team`, members
  in `RotationMember`.
- **Why:** it's 1-per-team in v1, so a dedicated table is a speculative table;
  YAGNI. Still normalized (real FKs, unique order).
- **Rejected:** separate rotation entity (eases v2 multi-rotation but builds for
  v2 early); userId array on Team (no integrity, awkward Postgres arrays).

### 5-minute default timeout, per-team overridable
- **Decision:** `Team.escalationTimeoutMinutes` defaults to 5.
- **Why:** realistic and demo-friendly; admins can change it. (Seed uses 1m to
  make escalation quick to watch.)
- **Rejected:** 15m (slower demo); no default (forces config friction).

### No deletion in v1
- **Decision:** no delete for Team/Service/User.
- **Why:** there's no delete story yet, so it sidesteps the retention question
  (cascade vs restrict) entirely.
- **Rejected:** cascade (destroys incident history — wrong for an incident tool);
  restrict (needs error-flow UI nobody asked for).

### `idx(status, nextEscalationAt)`
- **Decision:** composite index on the Incident poller's exact predicate.
- **Why:** makes "find due TRIGGERED incidents" a cheap indexed scan — the
  enabler for staying queue-free.

---

## API

### Access-only JWT
- **Decision:** a single short-lived bearer token; refresh deferred to v2.
- **Why:** covers v1's needs with far less code/security surface.
- **Rejected:** access + refresh + rotation — more "production real" but more to
  build; a v2 hardening item.

### Action sub-resources for state changes
- **Decision:** `POST /incidents/:id/ack` and `/resolve`, not `PATCH { status }`.
- **Why:** each transition is an explicit, self-documenting endpoint with its own
  guard/authorization; the industry-norm pragmatic REST.
- **Rejected:** generic `PATCH status` — uniform but hides intent and forces
  server-side validation of every possible transition.

### Offset pagination
- **Decision:** `?page=&pageSize=`.
- **Why:** simple, supports "jump to page N", fine at this data scale.
- **Rejected:** cursor pagination — scales better but over-engineering for v1.

---

## Infrastructure / tech stack ("senior calls")

### Queue-free
- **Decision:** no Redis/BullMQ; escalation via a timestamp + interval poller,
  notification retry in-process.
- **Why:** the one thing explicitly cut to keep this full-stack, not a
  distributed-systems exercise. A poll on an indexed column is plenty at this scale.
- **Rejected:** a job queue — real infra dependency for no v1 benefit.

### Kept NestJS + Prisma + Postgres on purpose
- **Decision:** kept the pre-existing backend stack after a deliberate reset.
- **Why:** it's genuinely the right fit (modular DI, migrations, type safety) —
  chosen, not inherited by inertia.
- **Rejected:** switching stacks just because the scaffold predated the reset.

### React + Vite (SPA), Railway deploy
- **Decision:** plain SPA (no SSR); deploy to Railway.
- **Why:** fits "full-stack basics, not distributed"; Railway suits Node+Postgres
  with a generous tier.
- **Rejected:** Next.js (more moving parts than the goal needs).

### Ethereal for dev email
- **Decision:** nodemailer + Ethereal test SMTP (real send + preview URL), with an
  in-memory stream-transport fallback.
- **Why:** real sending with zero domain setup; the fallback keeps the app running
  offline.
- **Rejected:** starting on Resend (needs a domain/key); console-only (not a real send).

### Full v1 schema now, built in slices
- **Decision:** wrote the entire v1 Prisma schema up front; build features in slices.
- **Why:** it's fully designed, so writing it once avoids migration churn; the
  walking skeleton just exercises a slice via seed data.
- **Rejected:** a throwaway skeleton-only schema — guarantees rework.

---

## Build-time engineering notes (Prisma 7 + TS 6 gotchas)

- **Load `.env` explicitly** via `import 'dotenv/config'` in `main.ts` and
  `seed.ts` — Nest and tsx don't auto-load it; without it Prisma hit a nonexistent
  default DB.
- **Stale generated client:** Prisma 7's `prisma-client` generator left an empty
  `src/generated/prisma`; a clean `rm -rf` + `prisma generate` fixed missing model
  delegates.
- **Jest + Prisma 7 + TS 6** needed: a `tsconfig.spec.json` with `noEmit`
  (sidesteps TS5011 output-layout check), a `moduleNameMapper` stripping `.js`
  from the client's ESM specifiers, and `NODE_OPTIONS=--experimental-vm-modules`
  (the Prisma 7 client uses dynamic `import()`).
