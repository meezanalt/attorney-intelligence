# Attorney Intelligence

Standalone Next.js (Pages Router) app for matter-based attorney matching via RAG + LLM scoring.

Default demo firm: **Harrow & Vance** (fictional). Branding is env-driven.

## Stack

- Next.js 15 (pages router) + React 18
- MongoDB (embeddings, search logs, rate limits)
- OpenAI (`text-embedding-3-small` + chat scoring)
- Optional Upstash Redis for rate limiting

## Setup

```bash
cp .env.example .env.local
# Fill in MONGODB_URI, OPENAI_API_KEY, CHAT_IP_HASH_SECRET
npm install
```

## Seed

Embeds `demo-data/attorneys.json` into `MONGODB_DB_NAME` (default `attorney_intelligence`):

```bash
npm run seed
```

Resumable via `SeedProgress` — re-run safely; already-done items are skipped.

Without Atlas vector search, set `CHAT_VECTOR_SEARCH_ENABLED=false` (default) — retrieval uses JS cosine similarity.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/attorney-search`.

## Architecture (brief)

1. **Classify** — heuristics + GPT map the matter to practice/location hints  
2. **Retrieve** — embed query, filter bio chunks (`relatedPractices` / `relatedLocations`), fallback chain if sparse  
3. **Score** — GPT ranks candidates; UI shows match % + finding  
4. **Bios** — static pages from demo JSON at `/attorneys/[slug]`

Key modules live under `src/lib/chat/`. APIs: `POST /api/attorney-search`, `GET /api/attorney-search/filters`.

## Env branding

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_FIRM_NAME` | Harrow & Vance |
| `NEXT_PUBLIC_FIRM_PRODUCT` | Attorney Intelligence |
| `NEXT_PUBLIC_FIRM_WEBSITE` | harrowvance.demo |
| `MONGODB_DB_NAME` | attorney_intelligence |

See `.env.example` for the full list.
