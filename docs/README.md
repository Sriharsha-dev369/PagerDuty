# 📐 Design Docs — PagerDuty-Lite

These are the **pre-development design artifacts** — the decisions made *before* writing
feature code, chosen by one rule:

> **Front-load what is expensive to reverse. Defer what is cheap to change.**

Read them in this order:

| # | Doc | Answers | Stability |
|---|-----|---------|-----------|
| 1 | [conventions.md](./conventions.md) | *How do we name, respond, error, paginate, configure?* — the rules every endpoint obeys | 🔒 decide once, rarely change |
| 2 | [data-model.md](./data-model.md) | *What are the entities, fields, relations, constraints?* — the hardest thing to change later | 🔒 grows per slice, never reshaped |
| 3 | [architecture.md](./architecture.md) | *How does a request flow? Where do layers / cross-cutting concerns live?* | 🔒 structural |
| 4 | [dependency-graph.md](./dependency-graph.md) | *What depends on what — so in what order do we build?* | 🔁 reference while sequencing |
| 5 | [api-contract.md](./api-contract.md) | *Exact endpoints: routes, bodies, responses, errors* | 🔁 detailed per-slice, extended as we go |

## Method (applies to all of these)

- **Vertical slices** — build one feature end-to-end (schema → service → controller → test) before the next.
- **Build the noun before the verb that needs it** — see [dependency-graph.md](./dependency-graph.md).
- **Detail just-in-time** — these docs are *fully detailed for Phase 1 (Core Domain)* and *outlined* beyond it. We flesh out each later module when its slice arrives, not before — pre-speccing all 11 modules is planning disguised as progress.
