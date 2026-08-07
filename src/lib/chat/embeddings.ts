import OpenAI from 'openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100; // OpenAI max inputs per request
const MAX_RETRIES = 8;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedBatchWithRetry(client: OpenAI, inputs: string[]): Promise<number[][]> {
  let delay = BASE_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
        dimensions: EMBEDDING_DIMENSIONS,
      });
      // Return embeddings in the same order as inputs
      return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof OpenAI.APIError && (err.status === 429 || err.status >= 500);
      if (!isRateLimit || attempt === MAX_RETRIES) throw err;

      const jitter = Math.floor(Math.random() * 250);
      const wait = Math.min(delay, MAX_DELAY_MS) + jitter;
      console.warn(`[embeddings] attempt ${attempt}/${MAX_RETRIES} — retrying in ${wait}ms`);
      await sleep(wait);
      delay = Math.min(delay * 2, MAX_DELAY_MS);
    }
  }

  throw new Error('embedBatchWithRetry: exhausted retries (unreachable)');
}

/**
 * Embed an array of texts in batches of up to BATCH_SIZE.
 * Returns one embedding vector (length 1536) per input text, in the same order.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getClient();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const vectors = await embedBatchWithRetry(client, batch);
    results.push(...vectors);
  }

  return results;
}

/**
 * Embed a single query text for retrieval.
 * Cheaper than embedTexts for one-off lookups.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const vectors = await embedTexts([text]);
  return vectors[0];
}

export { EMBEDDING_DIMENSIONS };
