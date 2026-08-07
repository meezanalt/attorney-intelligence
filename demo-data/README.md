# Demo corpus

Static JSON at `attorneys.json` — fictional attorney directory for product demos.

## Contents

- ~100 fictional attorney bios plus practice/office pages
- Offices: Boston, Chicago, Denver, Seattle
- Practice tags align with `CANONICAL_PRACTICES` in `src/lib/chat/practice-hints.ts`

## Seed

```bash
npm run seed
```

Requires `MONGODB_URI` and `OPENAI_API_KEY`. Embeddings land in `MONGODB_DB_NAME` (default `attorney_intelligence`).

Do not edit attorney content in `attorneys.json` unless regenerating the demo corpus intentionally.
