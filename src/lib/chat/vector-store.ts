import { getChatEmbeddingModel } from './chat-db';
import { BIO_DETAIL } from './templates';
import { buildEnumerationIncompleteNote } from './firm-config';
import { expandLocationHints, logDiscoveryDebug, officesForState } from './location-hints';
import type { ChatChunk, EmbeddedChunk, RetrievedChunk, FindResult } from './types';

const VECTOR_SEARCH_INDEX = 'chat_vector_index';
const MIN_DISCOVERY_RESULTS = 3;
/** Safety cap — firm directories are well under this; prevents runaway context size. */
const ENUMERATION_MAX_ITEMS = 200;

type DiscoveryAttempt = 'practice_and_location' | 'practice_only' | 'bio_semantic' | 'none';

/**
 * Prefer Atlas $vectorSearch when enabled; fall back to JS cosine if the index
 * is missing or mongot is unreachable (common on a newly created DB).
 */
async function semanticSearch(
  queryEmbedding: number[],
  limit: number,
  filter: BaseFilter,
  vectorSearchEnabled: boolean
): Promise<RetrievedChunk[]> {
  if (!vectorSearchEnabled) {
    return jsSearch(queryEmbedding, limit, filter);
  }
  try {
    return await atlasSearch(queryEmbedding, limit, filter);
  } catch (err) {
    console.warn(
      '[chat/vector-store] Atlas $vectorSearch failed — falling back to JS cosine similarity:',
      err instanceof Error ? err.message : err
    );
    return jsSearch(queryEmbedding, limit, filter);
  }
}

/**
 * Delete all existing chunks for (itemId, language) then bulk-insert the new set.
 * This ensures no orphaned chunks remain after a re-embed.
 */
export async function replaceItemChunks(
  itemId: string,
  language: string,
  chunks: ChatChunk[],
  embeddings: number[][]
): Promise<void> {
  const ChatEmbeddingModel = await getChatEmbeddingModel();

  const docs: Omit<EmbeddedChunk, never>[] = chunks.map((chunk, i) => ({
    itemId: chunk.itemId,
    language: chunk.language,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    embedding: embeddings[i],
    templateType: chunk.templateType,
    title: chunk.title,
    url: chunk.url,
    relatedPractices: chunk.relatedPractices,
    relatedLocations: chunk.relatedLocations,
  }));

  await ChatEmbeddingModel.deleteMany({ itemId, language });

  if (docs.length > 0) {
    await ChatEmbeddingModel.insertMany(docs);
  }
}

/**
 * Cosine similarity between two equal-length vectors.
 * Used as the JS-side fallback when Atlas Vector Search is unavailable (dev/staging < M10).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

interface BaseFilter {
  templateType?: string;
  language: string;
  relatedPractices?: string[];
  relatedLocations?: string[];
}

function filterSnapshot(filter: BaseFilter): Record<string, unknown> {
  return {
    templateType: filter.templateType,
    language: filter.language,
    relatedPractices: filter.relatedPractices,
    relatedLocations: filter.relatedLocations,
  };
}

// Deduplicate chunks by itemId, keeping the highest-scoring chunk per attorney.
function deduplicateByItem(chunks: RetrievedChunk[], limit: number): RetrievedChunk[] {
  const seen = new Map<string, RetrievedChunk>();
  for (const chunk of chunks) {
    const existing = seen.get(chunk.itemId);
    if (!existing || (chunk.score ?? 0) > (existing.score ?? 0)) {
      seen.set(chunk.itemId, chunk);
    }
  }
  return [...seen.values()].slice(0, limit);
}

/**
 * Standard lookup retrieval — top-K chunks across all templates, no deduplication.
 */
export async function findSimilarChunks(
  queryEmbedding: number[],
  options: { limit?: number; templateType?: string; language?: string } = {}
): Promise<FindResult> {
  const { limit = 5, templateType, language = 'en' } = options;

  const vectorSearchEnabled = process.env.CHAT_VECTOR_SEARCH_ENABLED === 'true';
  const filter: BaseFilter = { language };
  if (templateType) filter.templateType = templateType;

  const chunks = await semanticSearch(queryEmbedding, limit, filter, vectorSearchEnabled);

  return { chunks };
}

/**
 * Discovery retrieval — pre-filter to Bio Detail chunks by practice/location,
 * with an explicit three-step fallback chain that sets a searchNote when the
 * filter is broadened. Results are deduplicated to one chunk per attorney.
 */
export async function findDiscoveryChunks(
  queryEmbedding: number[],
  options: {
    practiceHints?: string[];
    locationHints?: string[];
    language?: string;
    limit?: number;
  } = {}
): Promise<FindResult> {
  const {
    practiceHints = [],
    locationHints: rawLocationHints = [],
    language = 'en',
    limit = 20,
  } = options;

  const vectorSearchEnabled = process.env.CHAT_VECTOR_SEARCH_ENABLED === 'true';
  const { expanded: locationHints, stateLabels } = expandLocationHints(rawLocationHints);

  const hasPractice = practiceHints.length > 0;
  const hasLocation = locationHints.length > 0;

  logDiscoveryDebug({
    stage: 'start',
    practiceHints,
    locationHintsRaw: rawLocationHints,
    locationHintsExpanded: locationHints,
    stateLabelsExpanded: stateLabels,
    vectorSearchEnabled,
  });

  let attemptUsed: DiscoveryAttempt = 'none';

  // Attempt 1 — full filter: practice + location (location hints expanded state → offices)
  if (hasPractice || hasLocation) {
    const filter: BaseFilter = {
      templateType: BIO_DETAIL,
      language,
      ...(hasPractice ? { relatedPractices: practiceHints } : {}),
      ...(hasLocation ? { relatedLocations: locationHints } : {}),
    };
    const raw = await semanticSearch(queryEmbedding, limit * 3, filter, vectorSearchEnabled);
    const deduped = deduplicateByItem(raw, limit);

    logDiscoveryDebug({
      stage: 'attempt_1_practice_and_location',
      filter: filterSnapshot(filter),
      rawCount: raw.length,
      dedupedCount: deduped.length,
      minRequired: MIN_DISCOVERY_RESULTS,
    });

    if (deduped.length >= MIN_DISCOVERY_RESULTS) {
      attemptUsed = 'practice_and_location';
      let searchNote: string | undefined;

      if (stateLabels.length > 0 && hasLocation) {
        const officeLabel = stateLabels
          .flatMap((state) => officesForState(state))
          .join(', ');
        searchNote = `Results are filtered to attorneys with ${stateLabels.join(
          ' / '
        )} office locations (${officeLabel}). Include each attorney's office location from the context when listing them.`;
      } else if (rawLocationHints.length > 0 && hasPractice) {
        searchNote = `Results match the requested practice area and location (${rawLocationHints.join(
          ' / '
        )}). Include each attorney's office location from the context when listing them.`;
      }

      logDiscoveryDebug({
        stage: 'result',
        attemptUsed,
        fallbackFired: false,
        resultCount: deduped.length,
        searchNote: searchNote ?? null,
      });

      return { chunks: deduped, searchNote };
    }
  }

  // Attempt 2 — practice only (drop location)
  if (hasPractice && hasLocation) {
    const filter: BaseFilter = {
      templateType: BIO_DETAIL,
      language,
      relatedPractices: practiceHints,
    };
    const raw = await semanticSearch(queryEmbedding, limit * 3, filter, vectorSearchEnabled);
    const deduped = deduplicateByItem(raw, limit);

    logDiscoveryDebug({
      stage: 'attempt_2_practice_only',
      filter: filterSnapshot(filter),
      rawCount: raw.length,
      dedupedCount: deduped.length,
      minRequired: MIN_DISCOVERY_RESULTS,
    });

    if (deduped.length >= MIN_DISCOVERY_RESULTS) {
      attemptUsed = 'practice_only';
      const locationLabel = rawLocationHints.join(' / ');
      const searchNote = `Not enough attorneys matched both the practice area and ${locationLabel}. The attorneys below are firm-wide ${practiceHints.join(
        ' / '
      )} matches (office locations may differ). Mention this to the user before listing results.`;

      logDiscoveryDebug({
        stage: 'result',
        attemptUsed,
        fallbackFired: true,
        fallbackStep: 2,
        resultCount: deduped.length,
        searchNote,
      });

      return { chunks: deduped, searchNote };
    }
  }

  // Attempt 3 — Bio Detail only (drop all metadata filters)
  {
    const filter: BaseFilter = { templateType: BIO_DETAIL, language };
    const raw = await semanticSearch(queryEmbedding, limit * 3, filter, vectorSearchEnabled);
    const deduped = deduplicateByItem(raw, limit);

    logDiscoveryDebug({
      stage: 'attempt_3_bio_semantic',
      filter: filterSnapshot(filter),
      rawCount: raw.length,
      dedupedCount: deduped.length,
    });

    const narrowed: string[] = [];
    if (hasPractice) narrowed.push(`practice area (${practiceHints.join(', ')})`);
    if (rawLocationHints.length > 0) {
      narrowed.push(`location (${rawLocationHints.join(', ')})`);
    }
    const searchNote =
      narrowed.length > 0
        ? `No exact matches were found for ${narrowed.join(
            ' and '
          )}. Showing the most semantically relevant attorneys from the firm. Mention this to the user before listing results.`
        : undefined;

    attemptUsed = 'bio_semantic';

    logDiscoveryDebug({
      stage: 'result',
      attemptUsed,
      fallbackFired: narrowed.length > 0,
      fallbackStep: 3,
      resultCount: deduped.length,
      searchNote: searchNote ?? null,
    });

    return { chunks: deduped, searchNote };
  }
}

/**
 * Enumeration retrieval — returns one representative chunk per content item for a
 * given template type (chunkIndex 0), sorted alphabetically by title.
 * Does not use semantic similarity so directory questions get complete coverage.
 */
export async function findEnumerationChunks(options: {
  templateType: string;
  language?: string;
}): Promise<FindResult> {
  const { templateType, language = 'en' } = options;
  const ChatEmbeddingModel = await getChatEmbeddingModel();

  const docs = await ChatEmbeddingModel.find({
    templateType,
    language,
    chunkIndex: 0,
  })
    .select('itemId text title url templateType')
    .sort({ title: 1 })
    .limit(ENUMERATION_MAX_ITEMS + 1)
    .lean();

  const truncated = docs.length > ENUMERATION_MAX_ITEMS;
  const selected = truncated ? docs.slice(0, ENUMERATION_MAX_ITEMS) : docs;

  const chunks: RetrievedChunk[] = selected.map((doc) => ({
    itemId: doc.itemId as string,
    text: doc.text as string,
    title: doc.title as string,
    url: doc.url as string,
    templateType: doc.templateType as string,
  }));

  let searchNote: string | undefined;
  if (truncated) {
    searchNote = buildEnumerationIncompleteNote(ENUMERATION_MAX_ITEMS, docs.length);
  }

  return { chunks, searchNote };
}

// ---------------------------------------------------------------------------
// Internal search implementations
// ---------------------------------------------------------------------------

async function atlasSearch(
  queryEmbedding: number[],
  limit: number,
  filter: BaseFilter
): Promise<RetrievedChunk[]> {
  const mqlFilter: Record<string, unknown> = { language: { $eq: filter.language } };
  if (filter.templateType) mqlFilter['templateType'] = { $eq: filter.templateType };
  if (filter.relatedPractices?.length)
    mqlFilter['relatedPractices'] = { $in: filter.relatedPractices };
  if (filter.relatedLocations?.length)
    mqlFilter['relatedLocations'] = { $in: filter.relatedLocations };

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_SEARCH_INDEX,
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: Math.max(limit * 15, 150),
        limit,
        filter: mqlFilter,
      },
    },
    {
      $project: {
        _id: 0,
        itemId: 1,
        text: 1,
        title: 1,
        url: 1,
        templateType: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  return (await getChatEmbeddingModel()).aggregate<RetrievedChunk>(pipeline);
}

async function jsSearch(
  queryEmbedding: number[],
  limit: number,
  filter: BaseFilter
): Promise<RetrievedChunk[]> {
  const mongoFilter: Record<string, unknown> = { language: filter.language };
  if (filter.templateType) mongoFilter['templateType'] = filter.templateType;
  if (filter.relatedPractices?.length)
    mongoFilter['relatedPractices'] = { $in: filter.relatedPractices };
  if (filter.relatedLocations?.length)
    mongoFilter['relatedLocations'] = { $in: filter.relatedLocations };

  const docs = await (await getChatEmbeddingModel()).find(mongoFilter)
    .select('itemId text title url templateType embedding')
    .lean();

  return docs
    .map((doc) => ({
      itemId: doc.itemId as string,
      text: doc.text as string,
      title: doc.title as string,
      url: doc.url as string,
      templateType: doc.templateType as string,
      score: cosineSimilarity(queryEmbedding, doc.embedding as number[]),
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}
