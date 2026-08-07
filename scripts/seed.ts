/**
 * Seed script — embeds demo-data/attorneys.json into MongoDB.
 *
 * Usage:
 *   npm run seed
 *   npm run seed:force   # ignore SeedProgress and re-embed all items
 *
 * Required env:
 *   MONGODB_URI, OPENAI_API_KEY
 * Optional:
 *   MONGODB_DB_NAME=attorney_intelligence
 *   SEED_FORCE=true
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenvFlow from 'dotenv-flow';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(dotenvFlow as any).config({ path: path.join(__dirname, '..') });

import mongoose from 'mongoose';
import { chunkItem } from '../src/lib/chat/chunker';
import { withAssembledContent } from '../src/lib/chat/assemble-item-text';
import { embedTexts } from '../src/lib/chat/embeddings';
import { replaceItemChunks } from '../src/lib/chat/vector-store';
import SeedProgress from '../src/models/SeedProgress';
import type { ChatContentItem } from '../src/lib/chat/types';

const MONGODB_URI = process.env.MONGODB_URI as string;
const DB_NAME = process.env.MONGODB_DB_NAME || 'attorney_intelligence';
const MAX_WORKERS = 3;
const MIN_ITEM_GAP_MS = 500;
const FORCE_RESEED = process.argv.includes('--force') || process.env.SEED_FORCE === 'true';

const DATA_PATH = path.join(__dirname, '..', 'demo-data', 'attorneys.json');

interface DemoDataset {
  firm: { name: string; shortName: string; website: string };
  items: ChatContentItem[];
}

if (!MONGODB_URI) {
  console.error('[seed] MONGODB_URI is not set. Aborting.');
  process.exit(1);
}

async function connectMongo(): Promise<void> {
  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME, bufferCommands: false });
  console.log(`[seed] Connected to MongoDB db="${DB_NAME}"`);
}

async function isDone(itemId: string): Promise<boolean> {
  const record = await SeedProgress.findOne({ itemId });
  return record?.status === 'done';
}

async function markDone(itemId: string): Promise<void> {
  await SeedProgress.updateOne(
    { itemId },
    { $set: { status: 'done', error: undefined, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function markFailed(itemId: string, error: string): Promise<void> {
  await SeedProgress.updateOne(
    { itemId },
    { $set: { status: 'failed', error: error.slice(0, 500), updatedAt: new Date() } },
    { upsert: true }
  );
}

async function processItem(item: ChatContentItem): Promise<void> {
  if (!FORCE_RESEED && (await isDone(item.id))) {
    console.log(`[seed] skip (done) ${item.id} — ${item.title}`);
    return;
  }

  console.log(`[seed] processing ${item.id} — ${item.title} (${item.templateName})`);

  // Assemble enriched bio sections into content before chunking (chunker unchanged).
  const chunks = chunkItem(withAssembledContent(item));
  if (chunks.length === 0) {
    console.warn(`[seed] no chunks for ${item.id} — marking done anyway`);
    await markDone(item.id);
    return;
  }

  const texts = chunks.map((c) => c.text);
  const embeddings = await embedTexts(texts);
  await replaceItemChunks(item.id, item.language, chunks, embeddings);
  await markDone(item.id);
  console.log(`[seed] done ${item.id} (${chunks.length} chunks inserted)`);
}

async function workerPool(items: ChatContentItem[]): Promise<void> {
  const queue = [...items];
  let lastStartedAt = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;

      const now = Date.now();
      const nextAllowed = lastStartedAt + MIN_ITEM_GAP_MS;
      if (now < nextAllowed) {
        await new Promise((r) => setTimeout(r, nextAllowed - now));
      }
      lastStartedAt = Date.now();

      try {
        await processItem(item);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[seed] FAILED ${item.id}: ${msg}`);
        await markFailed(item.id, msg);
      }
    }
  };

  await Promise.all(Array.from({ length: MAX_WORKERS }, () => worker()));
}

function loadDataset(): DemoDataset {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw) as DemoDataset;
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error(`No items found in ${DATA_PATH}`);
  }
  return data;
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[seed] OPENAI_API_KEY is not set. Aborting.');
    process.exit(1);
  }

  const dataset = loadDataset();
  console.log(
    `[seed] Loaded ${dataset.items.length} items for ${dataset.firm.name} from demo-data/attorneys.json`
  );
  if (FORCE_RESEED) {
    console.log('[seed] --force: re-embedding all items (ignoring SeedProgress done state)');
  }

  await connectMongo();
  await workerPool(dataset.items);

  const approxChunks = dataset.items.reduce(
    (sum, item) => sum + chunkItem(withAssembledContent(item)).length,
    0
  );
  console.log(
    `\n[seed] === Complete: ${dataset.items.length} items, ~${approxChunks} chunks → db="${DB_NAME}" ===`
  );
  if (process.env.CHAT_VECTOR_SEARCH_ENABLED === 'true') {
    console.log(
      `[seed] Reminder: create an Atlas vector index on db "${DB_NAME}" collection chatembeddings ` +
        `(index name: chat_vector_index, path: embedding, 1536 dims).`
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
