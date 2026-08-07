import * as cheerio from 'cheerio';
import type { ChatContentItem, ChatChunk } from './types';

// Approximate token count: 1 token ≈ 4 chars for English prose.
// Target ~400 tokens per chunk, 100 token overlap for sliding window.
const CHUNK_CHARS = 1600;
const OVERLAP_CHARS = 400;
const MIN_CHUNK_CHARS = 80; // discard trivially short trailing chunks

/** Strip HTML tags and collapse whitespace. */
function stripHtml(html: string): string {
  if (!html || !html.trim()) return '';
  try {
    const $ = cheerio.load(html);
    return $('body').text().replace(/\s+/g, ' ').trim();
  } catch {
    // Fall back to a simple regex strip if cheerio fails
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Build the raw text to embed for a content item.
 * Ordering is deliberate: title first (highest weight), then structured metadata,
 * then prose content.
 */
function buildItemText(item: ChatContentItem): string {
  const parts: string[] = [];

  if (item.title) parts.push(item.title);
  if (item.extra) parts.push(item.extra);
  if (item.description) parts.push(stripHtml(item.description));
  if (item.content) parts.push(stripHtml(item.content));

  return parts.join('\n\n').replace(/\s+/g, ' ').trim();
}

/**
 * Split a long text into overlapping windows.
 * Returns an empty array when text is blank.
 */
function slidingWindow(text: string): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + CHUNK_CHARS;
    const chunk = text.slice(start, end).trim();
    if (chunk.length >= MIN_CHUNK_CHARS) {
      chunks.push(chunk);
    }
    if (end >= text.length) break;
    start = end - OVERLAP_CHARS;
  }

  return chunks;
}

/**
 * Convert a content item into one or more embeddable chunks.
 */
export function chunkItem(item: ChatContentItem): ChatChunk[] {
  const fullText = buildItemText(item);
  const windows = slidingWindow(fullText);

  // relatedPractices and relatedLocations are stored on every chunk so that
  // discovery pre-filtering covers all semantic windows of a bio, not just chunk 0.
  return windows.map((text, index) => ({
    itemId: item.id,
    language: item.language,
    chunkIndex: index,
    text,
    templateType: item.templateId,
    title: item.title,
    url: item.url,
    relatedPractices: item.relatedPractices,
    relatedLocations: item.relatedLocations,
  }));
}
