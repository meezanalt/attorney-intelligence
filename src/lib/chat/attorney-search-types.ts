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

export interface AttorneySearchFiltersResponse {
  practices: string[];
  locations: string[];
}
