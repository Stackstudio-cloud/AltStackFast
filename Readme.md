# Stackfast · Workflow Architect for AI Development

Build fast, and build right. Stackfast turns product ideas into actionable, tool‑aware build plans and keeps a living, validated registry of AI development tools.

Live links:

- **Frontend**: [stackfast.vercel.app](https://stackfast.vercel.app)
- **API**: [stackfast-api.vercel.app](https://stackfast-api.vercel.app)

---

## ✨ Highlights

- **Blueprints from plain English**: Structured, validated JSON plans with backend/frontend steps and workflow stages.
- **Trusted tool registry**: Curated profiles with Zod validation, provenance, and freshness goals.
- **Reliable by design**: Server‑side LLM, strict schemas, timeouts/retries, rate limiting, CORS/Helmet, and ETags.

---

## 🧱 Architecture

- **Frontend** (`packages/app`, Vite + React)
  - Calls the API only (no client LLM keys)
  - Tools grid and details, blueprint generator UI

- **API** (`packages/api`, Express)
  - `GET /v1/tools` → validated tool profiles (ETagged)
  - `POST /v1/blueprint` → strictly validated JSON blueprint
  - Security: CORS allowlist, Helmet, rate limits, `/healthz` + `/readyz`

- **Worker** (`packages/worker`)
  - GitHub changes → scrape site with Playwright → Gemini → Zod validate → Firestore

- **Schemas** (`packages/schemas`)
  - Shared Zod models; emits `toolProfile.schema.json` during build

Monorepo layout:

```text
Stackfast/
  packages/
    app/        # Vite + React UI
    api/        # Express API (serverless on Vercel)
    worker/     # RAG enrichment worker (containerized)
    schemas/    # Shared Zod types; emits JSON schema
  src/          # Legacy prototype (kept for reference)
```

---

## 🚀 Quick start (local)

Requirements: **Node 20+**, npm (or pnpm/yarn)

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

Run Worker (optional for ingestion/RAG):

```bash
npm run dev --workspace=@stackfast/worker
```

---

## 🔐 Environment

See `env.example` for the latest list. Key variables:

| Area | Variable | Description |
| --- | --- | --- |
| API | `GEMINI_API_KEY` | Google Generative Language API key (required) |
| API | `GEMINI_MODEL` | Gemini model name, default `gemini-1.5-flash` |
| API | `FRONTEND_ORIGIN` or `FRONTEND_ORIGINS` | Comma‑separated CORS allowlist |
| API/Worker | `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON (raw or base64) |
| Worker | `GITHUB_TOKEN` | Optional, raises GitHub API rate limits |
| Worker | `WORKER_PORT` | Local worker port, default `8080` |
| API | `WORKER_URL` | Direct worker fallback URL, default `http://localhost:8080/analyze` |
| API | `TOOLS_SOURCE` | `firestore` (prod) or `mock` (local) |

Optional (queueing): `QSTASH_URL`, `QSTASH_TOKEN`.

Frontend: `VITE_API_URL` (e.g., `https://stackfast-api.vercel.app`).

---

## 📚 API reference (essentials)

- **GET** `/v1/tools`
  - Response: `{ success: true, data: ToolProfile[], count, timestamp }`

- **POST** `/v1/blueprint`
  - Body: `{ rawIdea: string, stackRegistry?: any }`
  - Returns strictly validated JSON blueprint

- **Health**: `GET /healthz` → `ok`, `GET /readyz` → `{ ok, firestore }`

---

## 🧪 Quality & CI

- Lint (warnings fail CI):

```bash
npm run lint
```

- Tests:

```bash
npm run test
```

- Build all:

```bash
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs install → lint → build → tests on Node 20.

---

## 🗺️ Roadmap (high‑signal)

- **Catalog**: Firestore as source of truth, faceted search, details pages with deep links.
- **Ingestion (Worker)**: Scheduling, provenance, robust retries/backoff, human‑in‑the‑loop review.
- **Blueprints**: Streaming UI, saved/sharable plans, small template library.
- **Contracts**: Publish OpenAPI + JSON Schema; read‑only public API with rate limits; MCP parity.
- **Ops**: Sentry (FE+API), structured logs, dashboards, clear runbooks.

---

## 🤝 Contributing

- Open an issue with “feature” or “bug”
- PRs welcome—keep edits focused and typed

---

## 📝 License

MIT (see `LICENSE` if present)
