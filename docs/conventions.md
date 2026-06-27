# 📏 Conventions & Standards

The rules **every** endpoint, file, and table obeys. Decided once, here, so the codebase
stays consistent without re-deciding per feature. These are "expensive to reverse" — every
client and every module depends on them — so they live in one place.

---

## 1. REST & URL conventions

- **Base path:** `/api/v1` — versioned from day one so a `v2` never breaks existing clients.
- **Resources are plural nouns:** `/users`, `/teams`, `/incidents`.
- **Nesting only for ownership:** `/teams/:teamId/members`, `/services/:serviceId/incidents`.
- **Lowercase, hyphen-separated** multi-word paths: `/on-call/schedules`.
- **Actions that aren't CRUD become sub-resources or verbs on the resource:**
  `POST /incidents/:id/acknowledge`, `POST /incidents/:id/resolve` (state transitions, not generic `PATCH`).

## 2. HTTP methods → semantics

| Method | Use | Idempotent? |
|--------|-----|-------------|
| `GET` | read | yes |
| `POST` | create / trigger action | no |
| `PATCH` | partial update | no |
| `PUT` | full replace (rarely used here) | yes |
| `DELETE` | remove | yes |

## 3. Status codes

| Code | When |
|------|------|
| `200 OK` | successful GET / PATCH / action |
| `201 Created` | successful POST that creates a resource |
| `204 No Content` | successful DELETE |
| `400 Bad Request` | validation failure (DTO rejected) |
| `401 Unauthorized` | missing/invalid auth (Phase 2+) |
| `403 Forbidden` | authenticated but lacks role (RBAC) |
| `404 Not Found` | resource id doesn't exist |
| `409 Conflict` | uniqueness / state-machine violation (e.g. duplicate email) |
| `422` | *not used* — we use `400` for validation |
| `500` | unhandled server error |

## 4. Response shape

**Success — return the resource directly** (no envelope). Simpler for clients, less noise.

```jsonc
// GET /users/:id  → 200
{ "id": "uuid", "name": "Ada", "email": "ada@x.com", "role": "VIEWER", "createdAt": "...", "updatedAt": "..." }
```

**List endpoints — paginated envelope** (lists need metadata; single resources don't):

```jsonc
// GET /users?page=1&limit=20  → 200
{
  "data": [ /* User[] */ ],
  "meta": { "total": 137, "page": 1, "limit": 20, "totalPages": 7 }
}
```

**Error — one consistent shape, everywhere** (produced by a global exception filter):

```jsonc
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "A user with this email already exists",
  "path": "/api/v1/users",
  "timestamp": "2026-06-25T10:00:00.000Z"
}
```

`message` may be a string or an array of strings (validation returns one per failed rule).

## 5. Pagination, filtering, sorting (list endpoints)

- **Pagination:** `?page=1&limit=20` (defaults `page=1`, `limit=20`, `limit` capped at `100`).
- **Filtering:** explicit query params per field, e.g. `GET /incidents?state=triggered&severity=P1`.
- **Sorting:** `?sort=createdAt&order=desc` (default `createdAt desc`).

## 6. Validation

- **Every write body is a DTO** validated by the global `ValidationPipe`
  (`whitelist + forbidNonWhitelisted + transform`) — already wired in `main.ts`.
- **Never trust the client with server-owned fields** — DTOs exclude `id`, `passwordHash`,
  timestamps, and any computed/state field. The client sends `password`; the server derives `passwordHash`.

## 7. Errors

- Throw Nest `HttpException` subclasses (`NotFoundException`, `ConflictException`, …) from services.
- A **global exception filter** maps them to the shape in §4 — controllers never format errors.
- **Map Prisma errors** (e.g. `P2002` unique violation → `409 Conflict`, `P2025` not found → `404`).

## 8. Data conventions

- **IDs:** `uuid` (string) — non-guessable, safe to expose, no cross-table collisions.
- **Timestamps:** every table has `createdAt` (`@default(now())`) and `updatedAt` (`@updatedAt`).
- **Enums** live in the Prisma schema (`Role`, `Severity`, `IncidentState`, …) — DB-enforced, not free strings.
- **Deletes are hard deletes** for now. Soft-delete (`deletedAt`) is a documented future option for
  audit-sensitive tables (Incidents) — deferred, not built.
- **Money/time:** durations in **integer milliseconds**; timestamps in UTC ISO-8601.

## 9. Configuration & secrets

- **All config via env vars**, loaded through `@nestjs/config` (`ConfigModule`), never hard-coded.
- **Validate env at boot** — fail fast if `DATABASE_URL`/`JWT_SECRET`/etc. are missing.
- **`.env` is gitignored**; a committed **`.env.example`** documents every required var.
- Current vars: `DATABASE_URL`, `PORT`. Added per phase: `JWT_SECRET`, `JWT_REFRESH_SECRET`,
  `REDIS_URL`, `SMTP_*` (documented in `.env.example` as they land).

## 10. Auth (shape decided now, built Phase 2)

- **Bearer JWT** in `Authorization: Bearer <token>`; access + refresh tokens.
- **Passwords:** bcrypt-hashed, cost ≥ 10; plaintext never stored or logged.
- **RBAC:** route-level `@Roles(...)` guard against `Role` enum (`ADMIN`/`ON_CALL`/`VIEWER`).
- Until Phase 2, endpoints are open; the contract marks each endpoint's *eventual* required role.

## 11. File / naming conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `users.service.ts`, `create-user.dto.ts` |
| Classes | PascalCase | `UsersService`, `CreateUserDto` |
| DTOs | `Create<X>Dto` / `Update<X>Dto` | `UpdateUserDto` |
| One module per feature | folder = module | `users/`, `teams/` |
| Module folder layout | `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/` | — |

## 12. Testing

- **Unit tests** per service (`*.service.spec.ts`) — business logic with Prisma mocked.
- **E2E tests** per resource (`test/*.e2e-spec.ts`) — real HTTP → real (test) DB.
- **Definition of done for a slice:** at least one passing E2E proving the full request→DB→response path.
