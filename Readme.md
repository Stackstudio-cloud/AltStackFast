# Stackfast · Workflow Architect

Build fast, but build right. Stackfast helps you turn product ideas into actionable, tool‑aware build plans and keeps a living registry of AI development tools.

Live
- Frontend: `https://stackfast.vercel.app/`
- API: `https://stackfast-api.vercel.app/`

## ✨ What it does
- AI‑powered blueprint generation: turn a plain‑English idea into a structured build plan
- Tool registry: curated + validated profiles of AI dev tools (served as JSON)
- Superior DX: server‑side LLM calls, strict Zod validation, timeouts/retries, and rate limiting
- Production hardened: CORS, Helmet, API contracts, and predictable error surfaces

## 🧱 Architecture
- Frontend (Vite + React)
  - Calls our API only (no client LLM keys)
  - Fetches tool registry and displays beautiful cards
- API (Express on Vercel)
  - `/v1/tools` returns validated tool profiles
  - `/v1/blueprint` calls Gemini server‑side and returns JSON (with Zod validation)
  - Security: CORS, Helmet, rate limiters
- Monorepo
  - `packages/app` – frontend
  - `packages/api` – API
  - `packages/schemas` – shared Zod/TS types for tools

```
Stackfast/
  packages/
    app/        # Vite + React UI
    api/        # Express API (serverless on Vercel)
    schemas/    # Shared types/schemas
  src/          # Legacy prototype (kept for reference)
```

## 🚀 Quick start (local)
Requirements: Node 20+, npm (or pnpm/yarn)

Install deps (from repo root):
```bash
npm install
```
Run frontend:
```bash
npm run dev --workspace=@stackfast/app
```
Run API:
```bash
npm run dev --workspace=@stackfast/api
```

## 🔐 Environment variables
API (Vercel Project: stackfast‑api)
- `GEMINI_API_KEY`: Google Generative Language API key (required)
- `FRONTEND_ORIGIN`: Allowed origin for CORS (e.g. https://stackfast.vercel.app)
- `GOOGLE_APPLICATION_CREDENTIALS`: service account JSON (either raw JSON or base64‑encoded JSON)
- Optional (queueing/future): `QSTASH_URL`, `QSTASH_TOKEN`, `WORKER_URL`

Frontend (Vercel Project: stackfast)
- `VITE_API_URL`: Base URL to your API (e.g. https://stackfast-api.vercel.app)
- `VITE_GEMINI_API_KEY`: no longer required on the client (server does LLM calls)

## 📚 API Reference
- GET `/v1/tools`
  - Response: `{ success: true, data: ToolProfile[], count, timestamp }`
- POST `/v1/blueprint`
  - Body: `{ rawIdea: string, stackRegistry?: any }`
  - Returns strictly validated JSON blueprint
- GET `/healthz` → `ok`

## ☁️ Deployment (Vercel)
We use two Vercel projects for clarity and reliability.

Frontend project (packages/app)
- Framework: Vite
- Output: `dist` (handled by @vercel/static-build)
- `vercel.json` in `packages/app` rewrites `/api/*` to your API if desired

API project (packages/api)
- Root Directory: `packages/api`
- Install Command: `cd ../.. && npm install`
- Build/Output: leave empty (we provide config in `packages/api/vercel.json` or rely on zero‑config with `api/` entry)
- CORS: set `FRONTEND_ORIGIN`

## 🧪 Quality & Observability
- Zod validation on inputs and outputs
- Timeouts + retries around LLM calls
- Helmet + CORS + rate limiting
- Clear error payloads (no HTML surprises in JSON)

## 🗺️ Roadmap (high‑signal)
- Frontend/UX
  - Tool details page, deep links, and faceted filtering
  - SWR/React Query for caching and optimistic UX
- AI/Worker
  - Enrichment worker (scrape + analyze) and provenance
  - Caching of blueprints + streaming responses
- Platform/ops
  - CI (typecheck/lint/test) + preview URLs
  - Sentry for FE + API
  - Public read‑only API with rate limits

## 🤝 Contributing
- Open an issue with “feature” or “bug” label
- PRs welcome—keep edits focused and typed

## 📝 License
MIT (see LICENSE if present)
