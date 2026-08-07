export interface AttorneySearchResultItem {
  itemId: string;
  name: string;
  title: string;
  practice: string;
  location: string;
  practices: string[];
  locations: string[];
  url: string;
  photoUrl?: string;
  matchScore?: number;
  finding?: string;
}

export interface AttorneySearchResponse {
  query: string;
  scored: boolean;
  searchNote?: string;
  results: AttorneySearchResultItem[];
  emptyReason?: 'no_candidates' | 'below_threshold';
}

/** Progress stages emitted over the search SSE stream (before the final done event). */
export type AttorneySearchStage = 'reading' | 'searching' | 'evaluating' | 'ranking';

export type AttorneySearchStageEvent = {
  stage: AttorneySearchStage;
};

export type AttorneySearchDoneEvent = AttorneySearchResponse & {
  stage: 'done';
};

export type AttorneySearchStreamEvent = AttorneySearchStageEvent | AttorneySearchDoneEvent;

export interface AttorneySearchFiltersResponse {
  practices: string[];
  locations: string[];
}
