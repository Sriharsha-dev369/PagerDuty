# Design docs

Written from the working code (Slice 1). Read in this order:

1. [user-stories.md](./user-stories.md) — the requirements (actors, verbs, Core/Later, NEVERs)
2. [incident-state-machine.md](./incident-state-machine.md) — the core business logic
3. [data-model.md](./data-model.md) — entities, enums, indexes, ER diagram
4. [api-contract.md](./api-contract.md) — endpoints
5. [escalation-flow.md](./escalation-flow.md) — the queue-free timer mechanism
6. [architecture.md](./architecture.md) — how it's all wired: components, module/DI graph, layers, deployment
7. [decisions.md](./decisions.md) — **every decision + why + rejected alternative**
8. [plan.md](./plan.md) — the executed plan (design steps + build slices)

Each layer is derived from the one above it. `decisions.md` is the record of why
each choice was made the way it was.

> Older AI-authored planning docs from before the project reset live in
> `../Olddocs/` for reference only — they are not the plan.
