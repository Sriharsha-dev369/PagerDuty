# Technical Highlights & Honest Gaps

A candid read of what's genuinely impressive here, what's just competent, the
current gaps, and what would make the standout parts undeniable. Written to be
interview-honest, not marketing.

## The standout: the queue-free, timer-driven escalation engine

Most of this project is competent-but-standard (NestJS/Prisma/Postgres CRUD is
not itself impressive). **One part stands out** — the escalation engine — for
three concrete reasons:

1. **It's a time-driven state machine, not CRUD.** An incident escalates *itself*
   because a clock passed with no human action. Most portfolio projects have no
   time/async dimension; this is a harder class of problem.
   (`server/src/incidents/incidents.service.ts` → `escalateDue`,
   `server/src/escalation/escalation.scheduler.ts`.)
2. **Queue-free by deliberate design.** Deferred work done with one indexed column
   (`nextEscalationAt`) + `@@index([status, nextEscalationAt])` + a 30s poll — no
   Redis/BullMQ. "Why not a job queue?" is an interview trap; there's a real,
   defensible answer with tradeoffs (see [decisions.md](./decisions.md#queue-free)).
3. **Time made testable.** `runEscalations(now)` takes the clock as a parameter,
   so the escalation test drives it with a controlled `now` — deterministic, no
   `sleep`. Time is the hardest thing to test; doing it cleanly is a maturity marker.

The sentence that makes an interviewer lean in: *a self-escalating state machine,
queue-free by choice, with the time logic unit-tested.*

## Why queue-free (short version)
- **Good here:** fewer moving parts; durability for free (the pending job is a DB
  row, survives restarts); transactional consistency (one DB, no dual-write drift);
  debuggable with plain SQL.
- **Limits:** up to 30s latency; a real queue scales better at millions of timers;
  the in-process poller assumes a single instance.
- **Verdict:** right for this product at this scale. Full rationale in
  [decisions.md](./decisions.md#queue-free).

## Supporting bits (reinforce, don't stand alone)
- **Append-only audit timeline** (`IncidentEvent`) — event-sourcing-lite; thinking
  in *history*, not just current state.
- **Notification as a first-class entity** (`status`/`attempts`) — built for
  failure + retry, not just the happy path.
- **A decision log with rationale + rejected alternatives** — being able to justify
  every choice is rare and reads as senior.

## Honest gaps (and why naming them is a strength)
1. **Concurrency-safe escalation** — `escalateDue` is `findMany` + per-row
   `update`; correct on one instance, but not safe against overlapping runs.
   Fix: an atomic conditional `updateMany` guarded on the row still being due.
   *This is the single highest-leverage upgrade* — it turns "do you understand
   race conditions?" into a concrete artifact.
2. **B2B tenancy missing** — no `Organization` entity and no invite flow, so the
   product model is B2C-shaped under a B2B domain (see
   [decisions.md → Known gaps](./decisions.md#known-gaps--open-decisions)).
   Adding it introduces real multi-tenancy + invitations — more impressive, not less.
3. **Single-instance deploy assumption** — the timer runs in-process; multiple
   replicas would need a lock or a queue. Documented honestly in
   [architecture.md](./architecture.md).

## What would make it undeniably impressive (in priority order)
1. **Atomic/idempotent escalation** (small, biggest credibility gain).
2. **Deploy it** — the timer running in real prod, live URL.
3. **Organization + invites** — real B2B multi-tenancy.
4. **Health-check polling (v2)** — auto-*detect* failures, not just react.

## Resume framing
> Built a queue-free incident-escalation engine: a time-driven state machine that
> auto-escalates unacknowledged alerts down an on-call chain via an indexed
> timestamp poll (no Redis/queue), with the time-dependent logic covered by
> deterministic tests.

That one bullet carries most of the weight — so the highest-leverage work is
whatever makes *it* bulletproof (atomic escalation, then a live deploy).
