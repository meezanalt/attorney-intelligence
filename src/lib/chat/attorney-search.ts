import { getChatEmbeddingModel } from './chat-db';
import { BIO_DETAIL } from './templates';
import type { RetrievedChunk } from './types';
import type { AttorneyCandidate } from './attorney-search-scorer';

function inferTitle(text: string): string {
  if (/\b(?:co-)?managing partner\b/i.test(text)) return 'Managing Partner';
  if (/\bpartner\b/i.test(text)) return 'Partner';
  if (/\bspecial counsel\b/i.test(text)) return 'Special Counsel';
  if (/\bof counsel\b/i.test(text)) return 'Of Counsel';
  if (/\bcounsel\b/i.test(text)) return 'Counsel';
  if (/\bassociate\b/i.test(text)) return 'Associate';
  return 'Attorney';
}

function cleanBioExcerpt(text: string): string {
  return text
    .replace(/Position:\s*\{[^}]+\}/gi, '')
    .replace(/\|\s*Practice areas:[^|]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

/**
 * Enrich discovery chunks with practices/locations from MongoDB.
 */
export async function buildAttorneyCandidates(
  chunks: RetrievedChunk[]
): Promise<AttorneyCandidate[]> {
  if (chunks.length === 0) return [];

  const ChatEmbeddingModel = await getChatEmbeddingModel();

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    if (seen.has(chunk.itemId)) continue;
    seen.add(chunk.itemId);
    orderedIds.push(chunk.itemId);
  }

  const docs = await ChatEmbeddingModel.find({
    itemId: { $in: orderedIds },
    chunkIndex: 0,
  })
    .select('itemId title url photoUrl relatedPractices relatedLocations text')
    .lean();

  const byId = new Map(docs.map((d) => [d.itemId as string, d]));

  return orderedIds.map((id) => {
    const doc = byId.get(id);
    const chunk = chunks.find((c) => c.itemId === id)!;
    const text = (doc?.text as string) || chunk.text || '';
    const photoUrl =
      typeof doc?.photoUrl === 'string' && doc.photoUrl.trim()
        ? doc.photoUrl.trim()
        : undefined;

    return {
      itemId: id,
      name: (doc?.title as string) || chunk.title || 'Attorney',
      title: inferTitle(text),
      practices: ((doc?.relatedPractices as string[]) || []).filter(Boolean),
      locations: ((doc?.relatedLocations as string[]) || []).filter(Boolean),
      url: (doc?.url as string) || chunk.url || '',
      photoUrl,
      bioExcerpt: cleanBioExcerpt(text),
    };
  });
}

/** Distinct practice / location tags used by the search filter dropdowns. */
export async function getAttorneySearchFilterOptions(): Promise<{
  practices: string[];
  locations: string[];
}> {
  const ChatEmbeddingModel = await getChatEmbeddingModel();

  const [practices, locations] = await Promise.all([
    ChatEmbeddingModel.distinct('relatedPractices', {
      templateType: BIO_DETAIL,
      'relatedPractices.0': { $exists: true },
    }),
    ChatEmbeddingModel.distinct('relatedLocations', {
      templateType: BIO_DETAIL,
      'relatedLocations.0': { $exists: true },
    }),
  ]);

  const sortAlpha = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' });

  return {
    practices: (practices as string[])
      .filter((p) => typeof p === 'string' && p.trim())
      .sort(sortAlpha),
    locations: (locations as string[])
      .filter((l) => typeof l === 'string' && l.trim())
      .sort(sortAlpha),
  };
}
