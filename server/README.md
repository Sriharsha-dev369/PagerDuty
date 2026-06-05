# PagerDuty‑Lite — Backend (NestJS)

The NestJS API for **PagerDuty‑Lite**. For the full project overview, architecture, and roadmap, see the [root README](../README.md).

## Run

```bash
npm install
npm run start:dev      # http://localhost:3000
```

## Common scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Watch mode (hot reload) |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | Lint with ESLint |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End‑to‑end tests |

## Structure

Features are organized by module under `src/` — each feature gets its own folder containing its controller, service, DTOs, and entities.
