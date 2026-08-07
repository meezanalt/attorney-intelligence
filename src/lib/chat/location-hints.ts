/**
 * Maps state/region labels (from location hint extraction) to office
 * titles stored in relatedLocations. Bio items use city office names, not state names.
 *
 * Demo firm offices only: Boston, Chicago, Denver, Seattle.
 */
export const STATE_TO_OFFICES: Record<string, string[]> = {
  Massachusetts: ['Boston'],
  Illinois: ['Chicago'],
  Colorado: ['Denver'],
  Washington: ['Seattle'],
};

/** Offices for a state label. */
export function officesForState(state: string): string[] {
  return STATE_TO_OFFICES[state] ?? [];
}

/**
 * Expand state-level hints to the office city titles used in relatedLocations.
 * Returns the expanded filter values and which state labels were expanded.
 */
export function expandLocationHints(hints: string[]): {
  expanded: string[];
  stateLabels: string[];
} {
  const expanded = new Set<string>();
  const stateLabels: string[] = [];

  for (const hint of hints) {
    expanded.add(hint);
    const offices = STATE_TO_OFFICES[hint];
    if (offices) {
      stateLabels.push(hint);
      for (const office of offices) {
        expanded.add(office);
      }
    }
  }

  return { expanded: [...expanded], stateLabels };
}

export function logDiscoveryDebug(payload: Record<string, unknown>): void {
  if (process.env.CHAT_DISCOVERY_DEBUG === 'true') {
    console.log('[chat/discovery]', JSON.stringify(payload));
  }
}
