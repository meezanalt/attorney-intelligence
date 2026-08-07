import type { NextApiRequest, NextApiResponse } from 'next';
import { getAttorneySearchLogModel } from 'src/lib/chat/chat-db';
import { embedQuery } from 'src/lib/chat/embeddings';
import { findDiscoveryChunks } from 'src/lib/chat/vector-store';
import { classifyIntent } from 'src/lib/chat/intent-classifier';
import { checkChatRateLimit } from 'src/lib/chat/rate-limiter';
import { getClientIp } from 'src/lib/chat/client-ip';
import { hashClientIp } from 'src/lib/chat/ip-hash';
import { buildAttorneyCandidates } from 'src/lib/chat/attorney-search';
import {
  CANDIDATE_LIMIT,
  MAX_RESULTS,
  mergeSearchHints,
  scoreAttorneyCandidates,
  type AttorneyCandidate,
  type ScoredAttorney,
} from 'src/lib/chat/attorney-search-scorer';
import type {
  AttorneySearchResponse,
  AttorneySearchResultItem,
} from 'src/lib/chat/attorney-search-types';

export type { AttorneySearchResponse, AttorneySearchResultItem };

interface SearchBody {
  query?: string;
  practice?: string;
  location?: string;
}

const ANY_PRACTICE = 'Any practice';
const ANY_LOCATION = 'Any location';

function normalizeOptionalFilter(value: string | undefined, anyLabel: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === anyLabel) return undefined;
  return trimmed;
}

function toResultItem(
  c: AttorneyCandidate | ScoredAttorney,
  scored: boolean
): AttorneySearchResultItem {
  const scoredC = c as ScoredAttorney;
  return {
    itemId: c.itemId,
    name: c.name,
    title: c.title,
    practice: c.practices[0] || '',
    location: c.locations[0] || '',
    practices: c.practices,
    locations: c.locations,
    url: c.url,
    photoUrl: c.photoUrl,
    ...(scored && typeof scoredC.matchScore === 'number'
      ? { matchScore: scoredC.matchScore, finding: scoredC.reasoning }
      : {}),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Search service is not configured' });
  }

  const body = req.body as SearchBody;
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > 2000) {
    return res.status(400).json({ error: 'A search query is required' });
  }

  const practiceFilter = normalizeOptionalFilter(body.practice, ANY_PRACTICE);
  const locationFilter = normalizeOptionalFilter(body.location, ANY_LOCATION);

  const clientIp = getClientIp(req);
  const startedAt = Date.now();

  let ipHash: string;
  try {
    ipHash = hashClientIp(clientIp);
  } catch (err) {
    console.error('[attorney-search] IP hashing misconfigured:', err);
    return res.status(500).json({ error: 'Search service is not configured' });
  }

  const rate = await checkChatRateLimit(clientIp);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many requests. Please try again shortly.',
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  try {
    const classification = await classifyIntent(query);
    const { practiceHints, locationHints } = mergeSearchHints({
      queryPracticeHints: classification.practiceHints,
      queryLocationHints: classification.locationHints,
      practiceFilter,
      locationFilter,
    });

    const queryVec = await embedQuery(query);
    const discovery = await findDiscoveryChunks(queryVec, {
      practiceHints,
      locationHints,
      limit: CANDIDATE_LIMIT,
      language: 'en',
    });

    const candidates = await buildAttorneyCandidates(discovery.chunks);

    if (candidates.length === 0) {
      const empty: AttorneySearchResponse = {
        query,
        scored: false,
        searchNote: discovery.searchNote,
        results: [],
        emptyReason: 'no_candidates',
      };
      await logSearch({
        query,
        practiceFilter,
        locationFilter,
        matches: [],
        scored: false,
        searchNote: discovery.searchNote,
        ipHash,
        durationMs: Date.now() - startedAt,
      });
      return res.status(200).json(empty);
    }

    const scoredList = await scoreAttorneyCandidates(query, candidates);
    let scored = false;
    let finals: (AttorneyCandidate | ScoredAttorney)[];

    if (scoredList && scoredList.length > 0) {
      scored = true;
      finals = scoredList;
    } else if (scoredList && scoredList.length === 0) {
      // Scoring succeeded but nothing cleared the floor
      const empty: AttorneySearchResponse = {
        query,
        scored: true,
        searchNote: discovery.searchNote,
        results: [],
        emptyReason: 'below_threshold',
      };
      await logSearch({
        query,
        practiceFilter,
        locationFilter,
        matches: [],
        scored: true,
        searchNote: discovery.searchNote,
        ipHash,
        durationMs: Date.now() - startedAt,
      });
      return res.status(200).json(empty);
    } else {
      // Scoring failed — degrade to unscored discovery list
      scored = false;
      finals = candidates.slice(0, MAX_RESULTS);
    }

    const results = finals.map((c) => toResultItem(c, scored));

    const response: AttorneySearchResponse = {
      query,
      scored,
      searchNote: discovery.searchNote,
      results,
    };

    await logSearch({
      query,
      practiceFilter,
      locationFilter,
      matches: results.map((r) => ({
        itemId: r.itemId,
        name: r.name,
        matchScore: r.matchScore,
        reasoning: r.finding,
        url: r.url,
      })),
      scored,
      searchNote: discovery.searchNote,
      ipHash,
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error('[attorney-search] failed:', err);
    return res.status(500).json({ error: 'Search failed. Please try again.' });
  }
}

async function logSearch(payload: {
  query: string;
  practiceFilter?: string;
  locationFilter?: string;
  matches: Array<{
    itemId: string;
    name: string;
    matchScore?: number;
    reasoning?: string;
    url: string;
  }>;
  scored: boolean;
  searchNote?: string;
  ipHash: string;
  durationMs: number;
}): Promise<void> {
  try {
    const AttorneySearchLog = await getAttorneySearchLogModel();
    await AttorneySearchLog.create(payload);
  } catch (err) {
    console.error('[attorney-search] log write failed:', err);
  }
}
