import OpenAI from 'openai';
import {
  INDUSTRY_TEMPLATE,
  LOCATION_TEMPLATE,
  PRACTICE_TEMPLATE,
} from './templates';
import { logDiscoveryDebug } from './location-hints';
import {
  PRACTICE_KEYWORDS,
  filterToCanonicalPractices,
  formatPracticeListForPrompt,
} from './practice-hints';

export type QueryIntent = 'lookup' | 'discovery' | 'enumeration' | 'general';

export type EnumerationTarget = 'practice' | 'location' | 'industry';

export const ENUMERATION_TEMPLATE: Record<EnumerationTarget, string> = {
  practice: PRACTICE_TEMPLATE,
  location: LOCATION_TEMPLATE,
  industry: INDUSTRY_TEMPLATE,
};

export interface ClassificationResult {
  intent: QueryIntent;
  practiceHints: string[];
  locationHints: string[];
  /** Set when intent is "enumeration" — which content type to list. */
  enumerationTarget?: EnumerationTarget;
  gptUsed: boolean;
  /** True when GPT was called but timed out, errored, or returned unparseable output. */
  gptFailed?: boolean;
}

// ---------------------------------------------------------------------------
// Heuristic patterns
// ---------------------------------------------------------------------------

/** Two consecutive capitalised words not preceded by a location/practice keyword. */
const PROPER_NAME_RE = /\b[A-Z][a-z]{1,}\s+[A-Z][a-z]{1,}\b/;

/**
 * Explicit people-seeking terms that signal DISCOVERY intent when present
 * without a specific proper name.
 */
const DISCOVERY_EXPLICIT_RE =
  /\b(?:i need an?\s+|find me an?\s+|recommend(?:ing)?\s+an?\s+|are there (?:any\s+)?|do you have (?:any\s+)?)(?:attorney|lawyer|counsel|partner|associate)/i;

/** Broader people-seeking: "need a lawyer / attorney / counsel" anywhere in the query. */
const NEED_LAWYER_RE =
  /\b(?:need|find|looking for|want|hire)\s+(?:an?\s+)?(?:attorney|lawyer|counsel)\b/i;

/**
 * Natural legal-need phrasing — how real clients describe problems without
 * practice-area jargon. Routes to DISCOVERY so we can map the situation to
 * practice tags via GPT (or keyword aliases).
 * Intentionally excludes bare matter nouns alone (e.g. "contract dispute") so
 * purely informational questions like "what is a contract dispute" are not
 * forced into discovery by heuristics — GPT decides those.
 */
const LEGAL_NEED_RE =
  /\b(?:i need help with|need help with|looking for help with|help me with|help with a|have a (?:legal )?(?:issue|problem|matter|dispute|claim)|facing a|dealing with a|sell(?:ing)? (?:my |our |the )?company|sell(?:ing)? (?:my |our |the )?business)\b/i;

/** "who handles" unconditionally signals DISCOVERY (not "who is"). */
const WHO_HANDLES_RE = /\bwho handles\b/i;

/** attorneys/lawyers followed by "in", "for", "who", "that", "with" also signals DISCOVERY. */
const ATTORNEYS_QUALIFIED_RE =
  /\b(?:attorneys?|lawyers?)\s+(?:in|for|who|that|with|specializ|to help)\b/i;

/** Signals a single specific capability page, not a directory listing. */
const SINGULAR_CAPABILITY_RE = /\b(?:have a|offer a|about the|about our|tell me about the)\b/i;

/** List-style phrasing that asks for a directory, not one item. */
const ENUMERATION_LIST_RE =
  /\b(?:what|which|where are|list(?: all)?|how many|all of (?:your|the)|every)\b/i;

/** Signals that likely indicate a lookup of one practice/capability page. */
const CAPABILITY_LOOKUP_RE =
  /\b(?:tell me about (?:the\s+)?[\w-]+\s+practice|does (?:the firm)\s+have a|does the firm offer a|what is the)\b/i;

/** Singular practice-depth questions (not directory listings). */
const SINGULAR_PRACTICE_DEPTH_RE =
  /\b(?:what is|how does)\b.*\b(?:approach|philosophy|expertise|capabilities|services)\b/i;

const LOCATION_KEYWORDS: [string, string][] = [
  ['chicago', 'Chicago'],
  ['seattle', 'Seattle'],
  ['boston', 'Boston'],
  ['denver', 'Denver'],
  ['massachusetts', 'Massachusetts'],
  ['illinois', 'Illinois'],
  ['colorado', 'Colorado'],
  ['washington', 'Washington'],
  ['california', 'California'],
  ['texas', 'Texas'],
];

function extractFromQuery(query: string, keywords: [string, string][]): string[] {
  const lower = query.toLowerCase();
  const found = new Set<string>();
  for (const [pattern, label] of keywords) {
    if (new RegExp(pattern, 'i').test(lower)) {
      found.add(label);
    }
  }
  return [...found];
}

function detectEnumerationTarget(query: string): EnumerationTarget | null {
  const q = query.toLowerCase();

  if (
    /\b(?:what|which|list|all)\b.*\bpractice\s*areas?\b/.test(q) ||
    /\bpractice\s*areas?\s+(?:do|does)\b/.test(q) ||
    /\b(?:what|which)\s+practices?\s+(?:do|does)\b/.test(q) ||
    /\b(?:what|which)\s+areas?\s+(?:of law\s+)?(?:do|does)\b/.test(q)
  ) {
    return 'practice';
  }

  if (
    /\b(?:where are|what|which|list|all)\b.*\b(?:offices?|office locations?)\b/.test(q) ||
    /\b(?:where|what)\s+(?:are\s+)?(?:your\s+)?(?:offices?|locations?)\b/.test(q) ||
    /\boffice\s+locations?\b/.test(q)
  ) {
    return 'location';
  }

  if (
    /\b(?:what|which|list|all)\b.*\bindustr(?:y|ies)\b/.test(q) ||
    /\bindustr(?:y|ies)\s+(?:do|does|groups?)\b/.test(q) ||
    /\b(?:what|which)\s+industr(?:y|ies)\s+(?:do|does)\b/.test(q)
  ) {
    return 'industry';
  }

  return null;
}

function isEnumerationQuery(query: string): boolean {
  return (
    ENUMERATION_LIST_RE.test(query) ||
    /\b(?:do you have|does the firm have)\b.*\b(?:any|all)\b/i.test(query)
  );
}

function looksLikeLegalNeed(query: string): boolean {
  return (
    DISCOVERY_EXPLICIT_RE.test(query) ||
    NEED_LAWYER_RE.test(query) ||
    LEGAL_NEED_RE.test(query) ||
    WHO_HANDLES_RE.test(query) ||
    ATTORNEYS_QUALIFIED_RE.test(query)
  );
}

/**
 * Soft signal used only when GPT times out/fails: first-person or business
 * situation language. Keeps heuristic layer from owning infinite aliases, but
 * prevents silent GENERAL when the classifier never finishes.
 */
function looksLikeSituationalMatter(query: string): boolean {
  const q = query.toLowerCase();
  if (/^(hi|hello|hey|thanks|thank you|good (morning|afternoon|evening))\b/.test(q.trim())) {
    return false;
  }
  const firstPerson = /\b(i|i'm|i've|we|we're|we've|my|our)\b/.test(q);
  const situation =
    /\b(dispute|sued|suing|lawsuit|fired|harass|stolen|copied|injured|accused|evict|landlord|partner|competitor|breach|unfair|wronged|harassed|terminated|acquiring|acquisition|deposit|wages|visa|injured|hurt)\b/.test(
      q
    );
  return firstPerson && situation;
}

// ---------------------------------------------------------------------------
// Heuristic classifier
// ---------------------------------------------------------------------------

type HeuristicResult =
  | {
      decided: true;
      intent: QueryIntent;
      practiceHints: string[];
      locationHints: string[];
      enumerationTarget?: EnumerationTarget;
    }
  | { decided: false; practiceHints: string[]; locationHints: string[] };

function heuristicClassify(query: string): HeuristicResult {
  const practiceHints = filterToCanonicalPractices(extractFromQuery(query, PRACTICE_KEYWORDS));
  const locationHints = extractFromQuery(query, LOCATION_KEYWORDS);

  // Proper name → LOOKUP (fires before discovery patterns so named people go to lookup)
  if (PROPER_NAME_RE.test(query)) {
    return { decided: true, intent: 'lookup', practiceHints, locationHints };
  }

  // Directory/list questions → ENUMERATION (before singular capability lookup)
  const enumerationTarget = detectEnumerationTarget(query);
  if (enumerationTarget && isEnumerationQuery(query) && !SINGULAR_CAPABILITY_RE.test(query)) {
    return {
      decided: true,
      intent: 'enumeration',
      enumerationTarget,
      practiceHints,
      locationHints,
    };
  }

  // Single capability/practice-page questions → LOOKUP
  if (CAPABILITY_LOOKUP_RE.test(query) || SINGULAR_PRACTICE_DEPTH_RE.test(query)) {
    return { decided: true, intent: 'lookup', practiceHints, locationHints };
  }

  // Explicit people-seeking / natural legal-need patterns → DISCOVERY
  if (looksLikeLegalNeed(query)) {
    return { decided: true, intent: 'discovery', practiceHints, locationHints };
  }

  // No strong signal — hand to GPT
  return { decided: false, practiceHints, locationHints };
}

// ---------------------------------------------------------------------------
// GPT mini classifier (ambiguous cases + practice-hint enrichment)
// ---------------------------------------------------------------------------

function buildGptClassifySystem(): string {
  return `You are a query classifier for a law firm chatbot. Return JSON only.

Classify the user query into one of:
- "lookup": asking about a specific attorney by name, a single practice area page, a firm capability, or one office
- "discovery": the user is seeking legal help / an attorney match — INCLUDING when they only describe a personal or business situation and never say "lawyer", "attorney", "need", or a practice-area name
- "enumeration": asking for a complete list or directory of practice areas, office locations, or industries
- "general": greeting, small talk, abstract legal education with no implied need for counsel, or clearly unrelated

DEFAULT RULE FOR SITUATIONS (critical):
If the user describes a real-world problem, conflict, harm, accusation, transaction, or workplace/business event that a law firm would typically handle — treat intent as "discovery" and infer practiceHints from context.
Examples of DISCOVERY even with zero legal vocabulary:
- "My business partner and I are in a dispute" → discovery (Litigation / Corporate)
- "I was fired and think it was unfair" → discovery (Labor and Employment)
- "We're being sued by a competitor" → discovery (Litigation)
- "Someone copied our product design" → discovery (Intellectual Property)
- "Our landlord won't return the deposit" → discovery (Real Estate / Litigation)
- "We want to acquire another company" → discovery (Mergers and Acquisitions)

Only use "general" for true non-matters (hi/thanks), or purely informational questions that clearly do NOT seek help (e.g. "what is a contract dispute", "define employment at-will"). When unsure between general and discovery for a first-person/business situation, choose discovery.

When intent is "enumeration", set enumerationTarget to "practice", "location", or "industry". Otherwise set enumerationTarget to null.

CRITICAL — practiceHints must be chosen ONLY from this exact list of firm practice areas (copy spelling exactly):
${formatPracticeListForPrompt()}

Infer the closest practice area(s) from the situation. Prefer 1–2 primary practices, not a long list.
Examples of mapping:
- partner/shareholder/vendor/customer dispute, being sued, lawsuit → Litigation (add Corporate if ownership/partner conflict)
- fired, unfair termination, workplace harassment, unpaid wages → Labor and Employment
- sell/buy company or business, acquisition → Mergers and Acquisitions
- visa / immigration status → Immigration
- copied product, patent, trademark, trade secret → Intellectual Property / Patent Litigation / Trademark / Trade Secrets as appropriate

locationHints: office/city/state names mentioned (e.g. "Chicago", "Boston", "Denver"); otherwise [].

Respond with exactly one JSON object and nothing else:
{"intent":"lookup"|"discovery"|"enumeration"|"general","enumerationTarget":"practice"|"location"|"industry"|null,"practiceHints":["..."],"locationHints":["..."]}`;
}

interface GptClassifyResponse {
  intent: QueryIntent;
  enumerationTarget?: EnumerationTarget | null;
  practiceHints: string[];
  locationHints: string[];
}

/** Extract a JSON object from GPT output that may include markdown fences or trailing junk. */
function parseGptJson(text: string): GptClassifyResponse | null {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const tryParse = (raw: string): GptClassifyResponse | null => {
    try {
      const parsed = JSON.parse(raw) as GptClassifyResponse;
      if (!['lookup', 'discovery', 'enumeration', 'general'].includes(parsed.intent)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const direct = tryParse(candidate);
  if (direct) return direct;

  // Truncate to the first balanced {...} object (handles trailing extra braces)
  const start = candidate.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === '{') depth++;
    else if (candidate[i] === '}') {
      depth--;
      if (depth === 0) {
        return tryParse(candidate.slice(start, i + 1));
      }
    }
  }

  return null;
}

const GPT_CLASSIFY_TIMEOUT_MS = 6000;

async function gptClassify(query: string): Promise<GptClassifyResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), GPT_CLASSIFY_TIMEOUT_MS);
  });

  try {
    const completionPromise = client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildGptClassifySystem() },
        { role: 'user', content: query },
      ],
      max_tokens: 180,
      temperature: 0,
      stream: false,
      response_format: { type: 'json_object' },
    });

    const winner = await Promise.race([completionPromise, timeoutPromise]);
    clearTimeout(timer);

    if (winner === null) return null; // timed out

    const text = winner.choices[0]?.message?.content?.trim();
    if (!text) {
      logDiscoveryDebug({ stage: 'gpt_classify', query, result: null, reason: 'empty_content' });
      return null;
    }

    const parsed = parseGptJson(text);
    logDiscoveryDebug({
      stage: 'gpt_classify',
      query,
      rawResponse: text,
      parsed: parsed
        ? {
            intent: parsed.intent,
            practiceHints: parsed.practiceHints,
            locationHints: parsed.locationHints,
            enumerationTarget: parsed.enumerationTarget ?? null,
          }
        : null,
      parseOk: Boolean(parsed),
    });
    if (!parsed) return null;

    const enumerationTarget =
      parsed.intent === 'enumeration' &&
      parsed.enumerationTarget &&
      ['practice', 'location', 'industry'].includes(parsed.enumerationTarget)
        ? parsed.enumerationTarget
        : undefined;

    return {
      intent: parsed.intent,
      enumerationTarget,
      practiceHints: filterToCanonicalPractices(
        Array.isArray(parsed.practiceHints) ? parsed.practiceHints : []
      ),
      locationHints: Array.isArray(parsed.locationHints) ? parsed.locationHints : [],
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function mergeHintLists(heuristic: string[], fromClassifier: string[]): string[] {
  return [...new Set([...fromClassifier, ...heuristic])];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Classify a user query as lookup / discovery / enumeration / general.
 *
 * Decision path:
 *  1. Heuristics (no API call) — fires for clear cases.
 *  2. When discovery is decided but practiceHints are empty, GPT enriches hints
 *     (natural-language problem → canonical practice tags).
 *  3. GPT mini — fires for ambiguous cases.
 *  4. If GPT fails: legal-need queries → discovery; otherwise → general.
 */
export async function classifyIntent(query: string): Promise<ClassificationResult> {
  const heuristic = heuristicClassify(query);

  if (heuristic.decided) {
    // Discovery with no practice tags yet — enrich via GPT so "sell my company"
    // becomes Mergers and Acquisitions instead of an unfiltered location search.
    if (heuristic.intent === 'discovery' && heuristic.practiceHints.length === 0) {
      const gpt = await gptClassify(query);
      if (gpt) {
        return {
          intent: 'discovery',
          practiceHints: mergeHintLists(heuristic.practiceHints, gpt.practiceHints),
          locationHints: mergeHintLists(heuristic.locationHints, gpt.locationHints),
          gptUsed: true,
        };
      }
      return {
        intent: 'discovery',
        practiceHints: heuristic.practiceHints,
        locationHints: heuristic.locationHints,
        gptUsed: true,
        gptFailed: true,
      };
    }

    return {
      intent: heuristic.intent,
      practiceHints: heuristic.practiceHints,
      locationHints: heuristic.locationHints,
      enumerationTarget: heuristic.enumerationTarget,
      gptUsed: false,
    };
  }

  // Ambiguous — try GPT
  const gpt = await gptClassify(query);

  if (gpt) {
    if (gpt.intent === 'enumeration' && !gpt.enumerationTarget) {
      const target = detectEnumerationTarget(query);
      if (target) {
        return {
          ...gpt,
          enumerationTarget: target,
          practiceHints: mergeHintLists(heuristic.practiceHints, gpt.practiceHints),
          locationHints: mergeHintLists(heuristic.locationHints, gpt.locationHints),
          gptUsed: true,
        };
      }
      return {
        intent: 'general',
        practiceHints: mergeHintLists(heuristic.practiceHints, gpt.practiceHints),
        locationHints: mergeHintLists(heuristic.locationHints, gpt.locationHints),
        gptUsed: true,
      };
    }
    return {
      ...gpt,
      enumerationTarget: gpt.enumerationTarget ?? undefined,
      practiceHints: mergeHintLists(heuristic.practiceHints, gpt.practiceHints),
      locationHints: mergeHintLists(heuristic.locationHints, gpt.locationHints),
      gptUsed: true,
    };
  }

  // GPT failed or timed out — prefer discovery for legal-need / situational phrasing
  if (looksLikeLegalNeed(query) || looksLikeSituationalMatter(query)) {
    return {
      intent: 'discovery',
      practiceHints: heuristic.practiceHints,
      locationHints: heuristic.locationHints,
      gptUsed: true,
      gptFailed: true,
    };
  }

  return {
    intent: 'general',
    practiceHints: heuristic.practiceHints,
    locationHints: heuristic.locationHints,
    gptUsed: true,
    gptFailed: true,
  };
}
