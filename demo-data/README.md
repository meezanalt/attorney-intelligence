# Demo corpus

Static JSON at `attorneys.json` — fictional attorney directory for product demos.

## Contents

- ~100+ fictional attorney bios plus practice/office pages
- Offices: Boston, Chicago, Denver, Seattle, Austin
- Practice tags align with `CANONICAL_PRACTICES` in `src/lib/chat/practice-hints.ts`
- Enriched bio fields: `experience`, `credentials`, `honors`, `memberships`, `thoughtLeadership`
  (assembled into embed text at seed time via `assembleItemContent` — chunker unchanged)
- Bio `gender`: `"male"` or `"female"`, assigned per attorney (see `NAME_GENDER` in
  `scripts/generate-demo-data.ts`)
- Bio `photoUrl`: local placeholder headshot (`/male-attorney.png` or `/female-attorney.png`
  from `public/`), selected based on `gender`

## Regenerate corpus

```bash
npm run generate-demo-data
```

## Seed

```bash
npm run seed
# Re-embed everything after corpus changes:
npm run seed:force
```

Requires `MONGODB_URI` and `OPENAI_API_KEY`. Embeddings land in `MONGODB_DB_NAME` (default `attorney_intelligence`).

Do not hand-edit attorney content in `attorneys.json` unless regenerating intentionally — prefer `generate-demo-data`.
