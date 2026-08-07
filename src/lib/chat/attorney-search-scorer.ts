import OpenAI from 'openai';
import { buildAttorneyScorerSystemPrompt } from './firm-config';
import { filterToCanonicalPractices } from './practice-hints';

export interface AttorneyCandidate {
  itemId: string;
  name: string;
  title: string;
  practices: string[];
  locations: string[];
  url: string;
  bioExcerpt: string;
  photoUrl?: string;
}

export interface ScoredAttorney extends AttorneyCandidate {
  matchScore: number;
  reasoning: string;
}

interface ScoreRow {
  attorneyId: string;
  matchScore: number;
  reasoning: string;
}

export const SCORE_FLOOR = 50;
export const MAX_RESULTS = 12;
export const CANDIDATE_LIMIT = 20;

function parseScoreJson(text: string): ScoreRow[] | null {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const tryParse = (raw: string): ScoreRow[] | null => {
    try {
      const parsed = JSON.parse(raw) as { results?: ScoreRow[] } | ScoreRow[];
      const rows = Array.isArray(parsed) ? parsed : parsed.results;
      if (!Array.isArray(rows)) return null;
      return rows.filter(
        (r) =>
          r &&
          typeof r.attorneyId === 'string' &&
          typeof r.matchScore === 'number' &&
          typeof r.reasoning === 'string'
      );
    } catch {
      return null;
    }
  };

  const direct = tryParse(candidate);
  if (direct) return direct;

  const start = candidate.indexOf('{');
  const arrStart = candidate.indexOf('[');
  const begin =
    start >= 0 && (arrStart < 0 || start < arrStart) ? start : arrStart >= 0 ? arrStart : -1;
  if (begin < 0) return null;

  const open = candidate[begin];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = begin; i < candidate.length; i++) {
    if (candidate[i] === open) depth++;
    else if (candidate[i] === close) {
      depth--;
      if (depth === 0) return tryParse(candidate.slice(begin, i + 1));
    }
  }
  return null;
}

function buildScorePrompt(query: string, candidates: AttorneyCandidate[]): string {
  const roster = candidates.map((c, i) => ({
    index: i + 1,
    attorneyId: c.itemId,
    name: c.name,
    title: c.title,
    practices: c.practices,
    locations: c.locations,
    bioExcerpt: c.bioExcerpt.slice(0, 600),
  }));

  return `You score how well each attorney matches a prospective client's legal matter.

Matter description:
"""${query}"""

Attorneys (JSON):
${JSON.stringify(roster, null, 2)}

Scoring rubric (use the full range — do not cluster everything in the 80s/90s):
- 90-100: Direct specialist for this exact need
- 70-89: Strong relevant experience, likely a good fit
- 50-69: Some relevant experience, not a specialist in this exact area
- Below 50: Not a meaningful match — still return the score; the caller will exclude them

For each attorney return:
- attorneyId: exact id from the roster
- matchScore: integer 0-100
- reasoning: 1-2 sentences, factual and specific (cite practice, office, or experience). Tone like a docket "Finding" — not marketing copy. Do not invent credentials absent from the bio.

Respond with JSON only:
{"results":[{"attorneyId":"...","matchScore":0,"reasoning":"..."}]}`;
}

/**
 * LLM scoring pass for attorney search. Returns null on failure so callers can
 * degrade to unscored discovery results.
 */
export async function scoreAttorneyCandidates(
  query: string,
  candidates: AttorneyCandidate[],
  options?: { signal?: AbortSignal }
): Promise<ScoredAttorney[] | null> {
  if (candidates.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create(
      {
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: buildAttorneyScorerSystemPrompt(),
          },
          { role: 'user', content: buildScorePrompt(query, candidates.slice(0, CANDIDATE_LIMIT)) },
        ],
        max_tokens: 2800,
        temperature: 0.25,
        stream: false,
        response_format: { type: 'json_object' },
      },
      options?.signal ? { signal: options.signal } : undefined
    );

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return null;

    const rows = parseScoreJson(text);
    if (!rows || rows.length === 0) return null;

    const byId = new Map(candidates.map((c) => [c.itemId, c]));
    const scored: ScoredAttorney[] = [];

    for (const row of rows) {
      const base = byId.get(row.attorneyId);
      if (!base) continue;
      const matchScore = Math.max(0, Math.min(100, Math.round(row.matchScore)));
      if (matchScore < SCORE_FLOOR) continue;
      scored.push({
        ...base,
        matchScore,
        reasoning: row.reasoning.trim().slice(0, 400),
      });
    }

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored.slice(0, MAX_RESULTS);
  } catch (err) {
    if (options?.signal?.aborted) return null;
    if (err instanceof Error && err.name === 'AbortError') return null;
    console.error('[attorney-search] scoring failed:', err);
    return null;
  }
}

/** Merge explicit UI filters with classifier hints; explicit dropdowns win when set. */
export function mergeSearchHints(options: {
  queryPracticeHints: string[];
  queryLocationHints: string[];
  practiceFilter?: string;
  locationFilter?: string;
}): { practiceHints: string[]; locationHints: string[] } {
  // Dropdown values are already distinct practice/location labels — pass through as-is.
  const practiceHints = options.practiceFilter?.trim()
    ? [options.practiceFilter.trim()]
    : filterToCanonicalPractices(options.queryPracticeHints);

  const locationHints = options.locationFilter?.trim()
    ? [options.locationFilter.trim()]
    : options.queryLocationHints;

  return { practiceHints, locationHints };
}
