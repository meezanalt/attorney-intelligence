/**
 * Canonical practice-area titles as stored in relatedPractices on embeddings.
 * GPT hint extraction and keyword maps must use these exact strings so
 * Atlas $in filters match demo corpus tags.
 */
export const CANONICAL_PRACTICES = [
  'Advertising',
  'Antitrust and Competition',
  'Appellate',
  'Bankruptcy and Restructuring',
  'Brand and Reputation Management',
  'Capital Markets, Securities and Governance',
  'Class Action Defense',
  'Commercial Finance',
  'Commercial Leasing',
  'Copyright',
  'Corporate',
  'Derivatives and Structured Products',
  'Emerging Company & Venture Capital',
  'Employee Benefits',
  'Entertainment, Technology and Advertising',
  'Entertainment and Media Litigation',
  'Estate Planning and Wealth Transfer',
  'Executive Compensation',
  'False Claims Act',
  'Financial Services Litigation',
  'Government Contracts',
  'Governmental',
  'Healthcare',
  'Immigration',
  'Intellectual Property',
  'International Arbitration',
  'International Trade',
  'Investment Management',
  'ITC Litigation',
  'Joint Ventures and Strategic Alliances',
  'Labor and Employment',
  'Labor and Employment Counseling',
  'Labor and Employment Litigation',
  'Land Use',
  'Land Use Litigation',
  'Leveraged Finance',
  'Litigation',
  'Mergers and Acquisitions',
  'National Security',
  'Patent Litigation',
  'Patent Strategy and Prosecution',
  'Privacy and Cybersecurity',
  'Private Equity',
  'Private Client Services',
  'Public Policy and Government Affairs',
  'Real Estate',
  'Real Estate Acquisitions and Dispositions',
  'Real Estate Finance',
  'Real Estate Litigation',
  'Securities Enforcement',
  'Securities Litigation',
  'Tax',
  'Trade Secrets',
  'Trademark',
  'White Collar Defense and Investigations',
] as const;

export type CanonicalPractice = (typeof CANONICAL_PRACTICES)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_PRACTICES);

/**
 * Natural-language / keyword → canonical practice title.
 * Used by heuristic extractors; GPT is instructed to emit canonical names directly.
 */
export const PRACTICE_KEYWORDS: [string, string][] = [
  ['real estate', 'Real Estate'],
  ['corporate', 'Corporate'],
  ['litigation', 'Litigation'],
  ['employment', 'Labor and Employment'],
  ['labor', 'Labor and Employment'],
  ['immigration', 'Immigration'],
  ['\\bip\\b', 'Intellectual Property'],
  ['intellectual property', 'Intellectual Property'],
  ['patent', 'Intellectual Property'],
  ['trademark', 'Trademark'],
  ['healthcare', 'Healthcare'],
  ['health care', 'Healthcare'],
  ['finance', 'Commercial Finance'],
  ['tax', 'Tax'],
  ['bankruptcy', 'Bankruptcy and Restructuring'],
  ['restructuring', 'Bankruptcy and Restructuring'],
  ['environmental', 'Land Use'],
  ['antitrust', 'Antitrust and Competition'],
  ['privacy', 'Privacy and Cybersecurity'],
  ['cybersecurity', 'Privacy and Cybersecurity'],
  ['securities', 'Securities Litigation'],
  ['mergers', 'Mergers and Acquisitions'],
  ['acquisitions', 'Mergers and Acquisitions'],
  ['m&a', 'Mergers and Acquisitions'],
  ['sell (?:my |our |a |the )?company', 'Mergers and Acquisitions'],
  ['selling (?:my |our |a |the )?company', 'Mergers and Acquisitions'],
  ['sell (?:my |our |the )?business', 'Mergers and Acquisitions'],
  ['buy (?:a |the )?company', 'Mergers and Acquisitions'],
  ['contract dispute', 'Litigation'],
  ['vendor dispute', 'Litigation'],
  ['commercial dispute', 'Litigation'],
  ['breach of contract', 'Litigation'],
  ['fired from', 'Labor and Employment'],
  ['wrongful termination', 'Labor and Employment'],
  ['employment dispute', 'Labor and Employment'],
  ['construction', 'Real Estate'],
  ['government contracts', 'Government Contracts'],
  ['insurance', 'Litigation'],
  ['entertainment', 'Entertainment, Technology and Advertising'],
  ['media', 'Entertainment, Technology and Advertising'],
  ['technology', 'Entertainment, Technology and Advertising'],
  ['private equity', 'Private Equity'],
  ['venture capital', 'Emerging Company & Venture Capital'],
  ['white collar', 'White Collar Defense and Investigations'],
  ['trade secret', 'Trade Secrets'],
];

/** Keep only practice titles that exist in the canonical list. */
export function filterToCanonicalPractices(hints: string[]): string[] {
  const out = new Set<string>();
  for (const hint of hints) {
    const trimmed = hint.trim();
    if (!trimmed) continue;
    if (CANONICAL_SET.has(trimmed)) {
      out.add(trimmed);
      continue;
    }
    // Case-insensitive exact match
    const lower = trimmed.toLowerCase();
    const exact = CANONICAL_PRACTICES.find((p) => p.toLowerCase() === lower);
    if (exact) {
      out.add(exact);
      continue;
    }
    // Soft contains: "Mergers" → "Mergers and Acquisitions"
    const soft = CANONICAL_PRACTICES.find(
      (p) => p.toLowerCase().includes(lower) || lower.includes(p.toLowerCase())
    );
    if (soft) out.add(soft);
  }
  return [...out];
}

export function formatPracticeListForPrompt(): string {
  return CANONICAL_PRACTICES.join(', ');
}
