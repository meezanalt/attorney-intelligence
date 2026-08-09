/** Credentials block used on enriched demo attorney bios. */
export interface AttorneyCredentials {
  education: string[];
  barAdmissions: string[];
}

/** Content item shape used by the chunker and seed pipeline. */
export interface ChatContentItem {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  url: string;
  /** Optional headshot URL (demo / directory photos). */
  photoUrl?: string;
  /** Main prose field (Content or Description, HTML-stripped by the chunker). */
  content: string;
  /** Short summary field (MetaDescription or Description). */
  description: string;
  /** Additional text fields assembled per template type (used for embedding text only). */
  extra: string;
  language: string;
  /** Structured practice area titles. Used for pre-filtering. */
  relatedPractices: string[];
  /** Structured location titles. Used for pre-filtering. */
  relatedLocations: string[];
  /** Representative matters/deals (demo enrichment). Concatenated into embed text at seed time. */
  experience?: string;
  /** Education and bar admissions (demo enrichment). */
  credentials?: AttorneyCredentials;
  /** Industry recognitions (demo enrichment). */
  honors?: string[];
  /** Professional memberships (demo enrichment). */
  memberships?: string[];
  /** Publications and speaking (demo enrichment). */
  thoughtLeadership?: string[];
}

/** A single sliding-window chunk ready for embedding. */
export interface ChatChunk {
  itemId: string;
  language: string;
  chunkIndex: number;
  text: string;
  templateType: string;
  title: string;
  url: string;
  photoUrl?: string;
  /** Carried on every chunk of an item so discovery pre-filtering covers all semantic chunks. */
  relatedPractices: string[];
  relatedLocations: string[];
}

/** A chunk as stored in MongoDB, with its embedding vector. */
export interface EmbeddedChunk {
  itemId: string;
  language: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  templateType: string;
  title: string;
  url: string;
  photoUrl?: string;
  relatedPractices: string[];
  relatedLocations: string[];
}

/** Result of a vector similarity search used for RAG context injection. */
export interface RetrievedChunk {
  itemId: string;
  text: string;
  title: string;
  url: string;
  templateType: string;
  score?: number;
}

/**
 * Return value of findSimilarChunks and findDiscoveryChunks.
 * searchNote is set when the fallback chain broadened the filter.
 */
export interface FindResult {
  chunks: RetrievedChunk[];
  searchNote?: string;
}
