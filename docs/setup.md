# Setup

## Run locally

```bash
./init.sh
pnpm install
cp .env.example .env.local   # fill in values; never commit this file
pnpm db:setup                # collections and Atlas Search / Vector Search indexes
pnpm db:fixtures             # loads fixtures/orbit.json into project "orbit"
pnpm dev
```

Check `http://localhost:3000/api/health` and `http://localhost:3000/api/ready`.

## Environment variables

| Variable | Needed by | Where to get it |
| --- | --- | --- |
| `MONGODB_URI` | everything | Atlas → Connect → Drivers. Connected through the Vercel MongoDB Atlas integration. |
| `MONGODB_DB` | everything | Optional. Defaults to `projectbrain`. |
| `OPENAI_API_KEY` | embeddings, extraction (`f-a-02`, `f-b-01`) | platform.openai.com → API keys |
| `OPENROUTER_API_KEY` | classification, judge, reflection | openrouter.ai → Keys |
| `SLACK_SIGNING_SECRET` | `f-a-06` | Slack app → Basic Information |
| `SLACK_BOT_TOKEN` | `f-b-05` | Slack app → OAuth & Permissions (install from `infra/slack-manifest.yml`) |
| `AWS_REGION`, `EVIDENCE_BUCKET` | `f-a-08`, `f-a-09` | AWS account |

Only `MONGODB_URI` is required for `/api/ready` to pass. The rest are reported as missing per feature and are not needed until that feature starts.

## Atlas notes

- Vector indexes use 1536 dimensions (OpenAI `text-embedding-3-small`) and cosine similarity.
- An M0 cluster allows three search indexes in total. `db:setup` creates exactly three: `attempts_vector`, `decisions_vector`, and `memory_text`.
- Search indexes take about a minute to become queryable after creation.
