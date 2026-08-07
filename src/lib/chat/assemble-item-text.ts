import type { ChatContentItem } from './types';

/**
 * Build the prose block that the chunker embeds for an attorney (or other) item.
 * Rich bio fields are concatenated as labeled sections so the existing sliding-window
 * chunker splits them naturally — without changing chunker.ts.
 */
export function assembleItemContent(item: ChatContentItem): string {
  const parts: string[] = [];

  if (item.content?.trim()) {
    parts.push(item.content.trim());
  }

  if (item.experience?.trim()) {
    parts.push(`Experience: ${item.experience.trim()}`);
  }

  if (item.credentials) {
    const credBits: string[] = [];
    if (item.credentials.education?.length) {
      credBits.push(`Education: ${item.credentials.education.join('; ')}`);
    }
    if (item.credentials.barAdmissions?.length) {
      credBits.push(`Bar Admissions: ${item.credentials.barAdmissions.join('; ')}`);
    }
    if (credBits.length) {
      parts.push(`Credentials: ${credBits.join('. ')}`);
    }
  }

  if (item.honors?.length) {
    parts.push(`Honors: ${item.honors.join('; ')}`);
  }

  if (item.memberships?.length) {
    parts.push(`Memberships: ${item.memberships.join('; ')}`);
  }

  if (item.thoughtLeadership?.length) {
    parts.push(`Thought Leadership: ${item.thoughtLeadership.join('; ')}`);
  }

  return parts.join('\n\n').trim();
}

/** Return a copy of the item with `content` expanded for chunking/embedding. */
export function withAssembledContent(item: ChatContentItem): ChatContentItem {
  const assembled = assembleItemContent(item);
  if (!assembled || assembled === (item.content || '').trim()) {
    return item;
  }
  return { ...item, content: assembled };
}
