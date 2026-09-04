# CascadeGuard

CascadeGuard is an autonomous cascading-risk investigation and intervention system for emergency decision support. It turns a crisis signal into a bounded, evidence-backed chain of possible failures and ranks the human intervention point with the most leverage.

## Demo

The default demo scenario is a replay of a 2026 Nepal flood event:

- **GDACS** provides the disaster event and reported displacement.
- **OpenStreetMap** provides nearby mapped infrastructure.
- The replay keeps source URLs, timestamps, locations, claims, source tiers, and confidence with every evidence record.
- Mapped infrastructure is treated as a dependency hypothesis, never as proof of damage or operational status.

Open the CascadeGuard web preview and run the prefilled investigation. Replay mode is deterministic and reliable for a three-minute demo. Live mode sends the bounded evidence review to Featherless when `FEATHERLESS_API_KEY` is configured; if the provider is unavailable, the API labels the replay-engine result as a fallback.

## Architecture

- `artifacts/cascadeguard-app` — React/Vite control room UI.
- `artifacts/api-server` — Express API with replay reasoning and Featherless live reasoning.
- `lib/api-spec/openapi.yaml` — OpenAPI-first contract.
- `lib/api-client-react` — generated React Query client.
- `lib/api-zod` — generated request and response validation schemas.

The first implementation intentionally avoids a database. The demo evidence is replayable, inspectable, and safe to run without external provider availability.

## Run locally

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/cascadeguard-app run dev
```

The managed Replit workflows already start these services for the preview. The API listens on the configured `PORT`.

## API

- `GET /api/healthz` — API health.
- `GET /api/scenario/nepal` — replay scenario and source-linked evidence.
- `POST /api/analyze` — bounded analysis with `{ "goal", "mode": "replay" | "live", "maxSteps" }`.

## Featherless configuration

Add `FEATHERLESS_API_KEY` through the workspace Secrets UI. Do not put the key in source code or commit it. Optional environment variables:

- `FEATHERLESS_BASE_URL` — defaults to `https://api.featherless.ai/v1`.
- `FEATHERLESS_MODEL` — defaults to `Qwen/Qwen2.5-7B-Instruct`.

## Verification

```bash
pnpm -w run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-spec run codegen
```