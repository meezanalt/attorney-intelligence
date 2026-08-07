/**
 * Firm branding and prompt helpers — driven by public env vars so the same
 * codebase can be white-labeled without client-specific hardcoding.
 */

export type FirmBranding = {
  name: string;
  shortName: string;
  website: string;
  productName: string;
};

export function getFirmBranding(): FirmBranding {
  const name = process.env.NEXT_PUBLIC_FIRM_NAME || 'Harrow & Vance';
  return {
    name,
    shortName: name,
    website: process.env.NEXT_PUBLIC_FIRM_WEBSITE || 'harrowvance.demo',
    productName: process.env.NEXT_PUBLIC_FIRM_PRODUCT || 'Attorney Intelligence',
  };
}

/** Build the attorney-scorer system prompt with the active firm branding. */
export function buildAttorneyScorerSystemPrompt(
  firm: FirmBranding = getFirmBranding()
): string {
  return `You are a careful legal-staffing analyst for ${firm.shortName}. Score attorney fit honestly. Return JSON only.`;
}

export function buildEnumerationIncompleteNote(
  showing: number,
  totalHint: number,
  firm: FirmBranding = getFirmBranding()
): string {
  return `Directory may be incomplete (showing ${showing} of ${totalHint}+ items). Mention ${firm.website} for the authoritative full directory when listing exhaustively.`;
}
