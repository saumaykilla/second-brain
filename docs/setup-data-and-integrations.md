# Setup: real data, vector search, and integrations

Second Brain runs on seeded fixture data with **zero config**. To make it a real,
data-rich system, connect **MongoDB Atlas** (for storage + vector search) and
**OpenAI** (for embeddings), then load a lot of data — either the built-in dummy
generator or the live Notion / Slack / GitHub integrations.

## 1. Environment

Copy `.env.example` → `.env.local` and fill in:

```bash
# Storage + vector search (required for real data)
MONGODB_URI="mongodb+srv://USER:PASS@cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB="second-brain"

# Embeddings (required for vector search) + answers
OPENAI_API_KEY="sk-..."
OPENROUTER_API_KEY="sk-or-..."   # optional; enables the strong-model judge/answers

# Protects the ingest API routes (choose any random string)
INGEST_SECRET="a-long-random-string"

# Integrations (only the ones you use)
NOTION_TOKEN="secret_..."            # Notion internal integration token
GITHUB_TOKEN="ghp_..."               # GitHub PAT with repo read
GITHUB_REPOS="owner/repo,owner/repo" # default repos to ingest
SLACK_BOT_TOKEN="xoxb-..."           # bot token with channels:history
```

> On Vercel, set the same variables in Project → Settings → Environment Variables.

## 2. Create the Atlas collections + vector indexes

```bash
pnpm install
pnpm db:setup
```

This creates every collection and the **vector search indexes**:
- `attempts_vector`, `decisions_vector`, `documents_vector` (the 3 that fit an Atlas
  **M0 free cluster**).
- Extended text indexes (`documents_text`, `memory_text`) are attempted too and
  **skipped automatically** on M0 — they need a paid tier (M10+). Vector search works
  without them.

> Atlas Search/Vector indexes take ~1–2 minutes to build. `pnpm db:setup` requests them;
> check Atlas → Search until status is `READY`.

## 3. Load a lot of data

### Option A — dummy data (fastest, no external accounts)

```bash
pnpm seed:dummy orbit 500
```

Generates ~500 knowledge documents (Notion-style notes, Slack messages, GitHub
PRs/issues/commits) plus extra attempts and decisions for the `orbit` project,
**embeds each with OpenAI**, and upserts into Atlas. (~500 embeddings ≈ a few cents and
a minute or two.) Re-running is idempotent.

### Option B — live integrations

Each pulls real content, embeds it, and stores it as knowledge documents. Run via CLI:

```bash
pnpm ingest notion orbit 100                 # 100 Notion pages the token can see
pnpm ingest github orbit "owner/api,owner/web"  # PRs/issues/commits from these repos
pnpm ingest slack  orbit "C0123ABC,C0456DEF"     # messages from these channel IDs
```

…or via the guarded API routes (e.g. from Vercel or a cron):

```bash
curl -X POST https://YOUR-APP/api/ingest/github \
  -H "authorization: Bearer $INGEST_SECRET" \
  -H "content-type: application/json" \
  -d '{"projectId":"orbit","repos":["owner/api"]}'
```

Routes: `POST /api/ingest/notion`, `/api/ingest/github`, `/api/ingest/slack`. All require
the `INGEST_SECRET` (as `Authorization: Bearer` or `?secret=`). If `INGEST_SECRET` is
unset the routes return 403 (disabled), so a deployed app can't be triggered by strangers.

**Getting the tokens:**
- **Notion:** create an internal integration at notion.so/my-integrations, copy the token,
  and *share* the pages/databases with the integration.
- **GitHub:** a fine-grained or classic PAT with read access to the repos.
- **Slack:** a bot token (`xoxb-…`) with `channels:history` (and `groups:history` for
  private channels); invite the bot to the channels. Channel IDs look like `C0123ABC`.

## 4. Use it

```bash
pnpm dev   # http://localhost:3000
```

- **Knowledge** (`/knowledge`) — semantic search across everything ingested, with
  Notion/Slack/GitHub filters. This is vector search over `documents_vector`.
- **Ask** (`/ask`) — answers now cite decisions, attempts, **and** ingested documents.
- **Timeline / Graph / Check / Lab / Impact** — as before, now over richer data.

## How the pieces fit

```
Notion / Slack / GitHub ─┐
     dummy generator ─────┤→ embed (OpenAI) → documents collection (Atlas)
                          │                        │
                          │                  documents_vector (Atlas Vector Search)
                          ▼                        ▼
                 /api/ingest/*            /api/search  +  /api/ask
                                                 ▼
                                    Knowledge tab  ·  Ask tab
```

## Costs & limits
- Embeddings use `text-embedding-3-small` (1536 dims) by default; the model comes from
  the active harness `routing.embed`.
- M0 free Atlas allows 3 search indexes total — this repo fits within that. More text
  indexes require M10+.
- Ingest routes have `maxDuration = 300`; very large backfills should be chunked (raise
  `perRepo` / `limit` gradually or call repeatedly).
