# 📡 API Contract

All conventions (base path, status codes, response/error shape, pagination, auth) live in
[conventions.md](./conventions.md) — this doc lists **endpoints**.

- **Base URL:** `/api/v1`
- **Detail level:** Phase 1 resources are **fully specified**; later modules are **outlined**
  (endpoint list only) and detailed when their slice is built — we don't pre-spec what we
  haven't reasoned through.
- **Auth column:** the role *eventually* required (Phase 2+). Endpoints are open until then.

---

## 👤 Users  — ◄ building now

| Method | Path | Purpose | Auth (future) |
|--------|------|---------|---------------|
| `POST` | `/users` | create a user | ADMIN |
| `GET` | `/users` | list users (paginated) | ADMIN |
| `GET` | `/users/:id` | get one user | ADMIN / self |
| `PATCH` | `/users/:id` | update a user | ADMIN / self |
| `DELETE` | `/users/:id` | delete a user | ADMIN |

### `POST /users` → `201`

Request body — `CreateUserDto`:
```jsonc
{
  "name": "Ada Lovelace",        // required, non-empty string
  "email": "ada@example.com",     // required, valid email, unique
  "password": "s3cret-pass",      // required, min 8 chars — hashed server-side
  "role": "ON_CALL"               // optional, enum Role, defaults to VIEWER
}
```
Response — `201`, the created user (**never** includes `passwordHash`):
```jsonc
{
  "id": "f0c1...uuid",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "ON_CALL",
  "createdAt": "2026-06-25T10:00:00.000Z",
  "updatedAt": "2026-06-25T10:00:00.000Z"
}
```
Errors:
| Code | When |
|------|------|
| `400` | missing/invalid field, unknown field sent, password too short |
| `409` | email already exists (Prisma `P2002`) |

### `GET /users` → `200`
Query: `?page=1&limit=20` (see conventions §5). Returns the paginated envelope:
```jsonc
{ "data": [ /* User[] (no passwordHash) */ ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 } }
```

### `GET /users/:id` → `200` | `404`
Returns one User (no `passwordHash`). `404` if id not found.

### `PATCH /users/:id` → `200`
Body — `UpdateUserDto` = all `CreateUserDto` fields **optional** (`PartialType`). Send only what
changes. Returns the updated User. `404` if not found; `409` on email conflict.

### `DELETE /users/:id` → `204`
No body on success. `404` if not found.

---

## 🧑‍🤝‍🧑 Teams  — Phase 1 (outline)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/teams` | create team |
| `GET` | `/teams` · `/teams/:id` | list / get |
| `PATCH` / `DELETE` | `/teams/:id` | update / delete |
| `POST` | `/teams/:id/members` | add a user to the team |
| `DELETE` | `/teams/:id/members/:userId` | remove a member |
| `GET` | `/teams/:id/members` | list members |

## 📡 Services  — Phase 1 (outline)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` `/services` · `GET` `/services` · `GET/PATCH/DELETE` `/services/:id` | CRUD |
| `GET` | `/services/:id/incidents` | incidents for a service |

## 🚨 Incidents  — Phase 1 (outline; state machine)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` `/incidents` · `GET` `/incidents` (filter by `state`,`severity`,`serviceId`) · `GET` `/incidents/:id` | CRUD-ish |
| `POST` | `/incidents/:id/acknowledge` | `TRIGGERED → ACKNOWLEDGED` |
| `POST` | `/incidents/:id/resolve` | `→ RESOLVED` |
| `POST` | `/incidents/:id/assign` | assign to a user |
| `GET` | `/incidents/:id/events` | activity timeline |

> State changes are **explicit action endpoints**, not generic `PATCH` — the state machine enforces
> legal transitions (you can't resolve an un-acknowledged incident, etc.).

---

## Later phases (endpoints defined when built)

`auth` (login/refresh/logout) · `on-call` (schedules/shifts/overrides/who's-on-call) ·
`notifications` (delivery status) · `webhooks` (inbound ingest) · `analytics` (mttr/uptime/heatmap).
These are intentionally **not specified yet** — designed per slice, per the build order in
[dependency-graph.md](./dependency-graph.md).
