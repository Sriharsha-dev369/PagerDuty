# User Stories

The requirements the data model and API are derived from. Each story is
`as a [actor], I [verb] so that [outcome]`, tagged **[Core]** (v1) or
**[Later]**, with **NEVER** guardrails (invariants that must always hold).

Status tags reflect Slice 1 (backend walking skeleton): ✅ implemented,
⏳ modeled but not yet built.

## Actors
- **Human:** Admin, Responder, Viewer (roles are per-team, on `Membership`)
- **Non-human:** Monitoring/Webhook source, System/Scheduler

The non-human actors add no scope — they name behaviors already in the core
loop (webhook trigger, timer escalation) so the automated paths get their own
stories and guardrails.

## 🔔 Monitoring / Webhook source
- ⏳ [Core] POST an alert to a service webhook (no login) → an incident is
  created and someone is notified.
  - NEVER: an unknown/invalid integration key creates an incident.
  - NEVER: a malformed payload crashes the endpoint (validate & reject).

## ⚙️ System / Scheduler
- ✅ [Core] Notify the assigned responder (email) on incident create and on escalation.
- ✅ [Core] Escalate an unacknowledged incident to the next person after the timeout.
  - NEVER: escalate an acknowledged or resolved incident.
  - NEVER: escalate past the last person in the chain (stop).
  - NEVER: notify a user who isn't the current target.

## 🧑‍🚒 Responder
- ✅ [Core] View the incidents that concern me / my team.
- ✅ [Core] Acknowledge an incident → escalation stops.
- ✅ [Core] Resolve an incident → marked done, timeline closes (may skip ack).
- ✅ [Core] Manually create an incident (currently via API; UI in a later slice).
- [Later] Add a note to an incident's timeline.
- [Later] Reassign an incident to someone else.

## 👤 Account / Auth
- ⏳ [Core] Sign up & log in, to access my teams and act under my role.
  - NEVER: an unauthenticated request reaches team/incident data (except the
    webhook, which authenticates via its integration key).
  - _Slice 1 note: no auth yet — the acting `userId` is passed in the request
    body. JWT replaces this in the auth slice._

## 🛠️ Admin (per-team)
- ⏳ [Core] Create a team (→ become its admin).
- ⏳ [Core] Add/remove members and set each one's role.
- ⏳ [Core] Register a service under the team (gets an integration key).
- ⏳ [Core] Define the team's on-call rotation (ordered responders + timeout).
  - NEVER: a non-admin changes membership, services, or the rotation.
- [Later] Regenerate a service's integration key.
- [Later] Edit/override/auto-rotate the schedule.

## 👀 Viewer (per-team)
- ⏳ [Core] See my team's incidents + current on-call, read-only.
  - NEVER: a viewer acks, resolves, creates, or edits anything.
  - _Slice 1 note: the responder/admin-only guard is enforced on ack/resolve
    (403 for non-members/viewers)._
