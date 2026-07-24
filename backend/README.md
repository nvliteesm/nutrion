# NutriON Backend

FastAPI backend for NutriON: food/drink/medical analyze → confirm → save, analytics, RAG chat, and grounded AI insights.

## Requirements

- Python **3.11+**
- Windows, macOS, or Linux
- Optional API keys (see [Environment](#environment)):
  - **Azure OpenAI / Foundry** — chat + embeddings (`/chat`, `/api/ai/analyze`)
  - **Azure Content Understanding** — drink labels / medical OCR
  - **Kimi / Moonshot** — food photo vision

Without live keys you can still start the API. Set `USE_LIVE_AI=false` (and keep `ALLOW_STUB_EMBEDDINGS=true`) for stub chat/embeddings.

## Quick start

From the repo root:

```bash
cd backend
```

### 1. Create a virtualenv and install deps

**Windows (PowerShell)**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

**macOS / Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and fill in keys you have. At minimum for live chat:

| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_API_KEY` | Foundry / Azure OpenAI key |
| `AZURE_OPENAI_ENDPOINT` | e.g. `https://YOUR-RESOURCE.services.ai.azure.com/openai/v1` |
| `AZURE_OPENAI_CHAT_DEPLOYMENT` | Chat deployment name (default `gpt-5-mini`) |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | Embedding deployment (default `text-embedding-3-small`) |
| `USE_LIVE_AI` | `true` for live models, `false` for stubs |
| `ALLOW_STUB_EMBEDDINGS` | `true` falls back to local stub vectors if embeddings fail |
| `CORS_ORIGINS` | Frontend origin(s), comma-separated (default `http://localhost:3000`) |

Optional:

| Variable | Purpose |
|----------|---------|
| `AZURE_CONTENT_ENDPOINT` / `AZURE_CONTENT_API_KEY` | OCR / document understanding |
| `KIMI_API_KEY` | Food photo analysis |

Data is stored under `backend/data/` (SQLite + Chroma). That folder is gitignored (see repo-root `.gitignore` and `backend/.gitignore`). Never commit `.env` — only `.env.example`.

### 3. Run the server

Always run commands from the `backend` directory with the venv active:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Then open:

- API root: http://127.0.0.1:8000/
- Interactive docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

On first startup the app creates SQLite tables and indexes approved educational knowledge into Chroma (may take a bit if embeddings are live).

## Smoke checks

**Health**

```bash
curl http://127.0.0.1:8000/health
```

**Chat (RAG over meal memory)**

```bash
curl -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"What did I eat recently?\", \"user_id\": \"default\"}"
```

macOS / Linux:

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What did I eat recently?", "user_id": "default"}'
```

**Index a sample meal (for chat memory)**

```bash
curl -X POST http://127.0.0.1:8000/memory/intakes \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"default\"}"
```

(Uses the default sample oatmeal body from the API schema if you open `/docs` and try it interactively.)

**Analytics (confirmed intakes)**

```bash
curl "http://127.0.0.1:8000/api/analytics/daily?user_id=default"
```

**AI analyzer**

```bash
curl -X POST http://127.0.0.1:8000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"How was my sugar this week?\", \"user_id\": \"default\"}"
```

There are also scripts under `scripts/` (e.g. `smoke_test.py`, `smoke_analytics.py`) you can run with the venv Python if present.

## Main API areas

| Area | Base path | Notes |
|------|-----------|--------|
| Confirm flow | `/api/foods`, `/api/drinks`, `/api/medical` | upload → analyze → confirm |
| Memory + chat | `/chat`, `/memory/*` | vector meal memory + RAG |
| Analytics | `/api/analytics/*` | SQL totals; no LLM math |
| AI analyzer | `/api/ai/*` | grounded explanations + insights |
| Legacy ingest | `/food`, `/drink`, `/document` | older one-shot ingest |
| Storage helpers | `/intakes`, `/totals/daily`, `/vector/search` | list / totals / search |

Full request/response shapes are in **Swagger**: `/docs`.

## Project layout

```
backend/
  app/
    api/           # route modules
    knowledge/     # approved educational docs for RAG
    models/        # ORM + Pydantic schemas
    services/      # business logic (Foundry, analytics, RAG, …)
    main.py        # FastAPI app entry
  data/            # local DB + Chroma (created at runtime)
  scripts/         # smoke tests
  .env.example
  requirements.txt
```

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| `ModuleNotFoundError` | Activate `.venv` and `pip install -r requirements.txt` from `backend/` |
| Port 8000 in use | Stop the other process, or use `--port 8001` |
| Chat returns stub text | Set `USE_LIVE_AI=true` and valid `AZURE_OPENAI_*` in `.env` |
| Embeddings / RAG errors | Keep `ALLOW_STUB_EMBEDDINGS=true`, or fix the embedding deployment name |
| Health `degraded` | Check `/health` → `services.foundry` / `vector_db` / `knowledge_base` details |
| CORS errors from frontend | Add the frontend origin to `CORS_ORIGINS` |

## Notes

- Default user scoping uses `user_id=default` (no auth yet).
- Analytics prefer **confirmed** nutrition rows unless you pass `confirmed_only=false`.
- Educational RAG uses the `approved_health_knowledge` Chroma collection; personal totals always come from SQL analytics, not from inventing numbers in the LLM.
