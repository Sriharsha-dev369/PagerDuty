# API Contract

The surface actors use to perform their stories against the model. Every
endpoint maps to a story.

**Conventions:** access-only JWT (bearer) once auth lands; action sub-resources
for state changes (`/ack`, `/resolve`) rather than `PATCH status`; offset
pagination (`?page=&pageSize=`); DTO validation via `class-validator`; error
shape `{ statusCode, message, error }`. Nested routes for list/create-under-parent,
flat routes for acting on a known resource.

Status: ✅ implemented in Slice 1 · ⏳ designed, not yet built.

## Incidents ✅ (Slice 1)
| Method & path | Story | Notes |
|---|---|---|
| `POST /services/:serviceId/incidents` | responder creates an incident | body: `{ title, description?, severity? }` → 201 incident (+timeline) |
| `GET /incidents` | view incidents | filters `?serviceId=&status=` |
| `GET /incidents/:id` | view one + timeline | includes ordered `events` + `notifications` |
| `POST /incidents/:id/ack` | acknowledge | body: `{ userId }` (temp; JWT later). 409 if resolved/acked, 403 if not responder |
| `POST /incidents/:id/resolve` | resolve | body: `{ userId }`. 409 if already resolved |

_Note: `GET /incidents/:id` returns the timeline inline, so a separate
`GET /incidents/:id/events` from the original design is redundant and was dropped._

## Webhook ⏳
| `POST /webhooks/incidents/:integrationKey` | monitoring creates an incident | no auth; key identifies the service |

## Auth ⏳
| `POST /auth/signup` · `POST /auth/login` · `GET /auth/me` | account access |

## Teams & members ⏳
| `POST /teams` (creator→admin) · `GET /teams` · `GET /teams/:id` |
| `POST/PATCH/DELETE /teams/:id/members[/:userId]` (admin) |

## Rotation ⏳
| `PUT /teams/:id/rotation` (admin; timeout + ordered members) · `GET /teams/:id/rotation` · `GET /teams/:id/oncall` |

## Services ⏳
| `POST /teams/:id/services` (admin, returns integrationKey) · `GET /teams/:id/services` · `GET /services/:id` · `PATCH /services/:id` (admin) |

See [decisions.md](./decisions.md) for why JWT is access-only, why action
endpoints over `PATCH status`, and why offset pagination.
