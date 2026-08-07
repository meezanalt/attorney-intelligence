/**
 * Chat / attorney-search Mongo connection.
 * Uses MONGODB_URI + MONGODB_DB_NAME (default attorney_intelligence).
 */

import mongoose, { Connection, Model } from 'mongoose';
import ChatEmbedding, { type IChatEmbedding } from 'src/models/ChatEmbedding';
import ChatRateLimit, { type IChatRateLimit } from 'src/models/ChatRateLimit';
import AttorneySearchLog, { type IAttorneySearchLog } from 'src/models/AttorneySearchLog';

const MONGODB_URI = process.env.MONGODB_URI as string;

function getChatMongoDbName(): string {
  return process.env.MONGODB_DB_NAME || 'attorney_intelligence';
}

interface ChatConnCache {
  conn: Connection | null;
  promise: Promise<Connection> | null;
  dbName?: string;
}

const globalWithChat = globalThis as typeof globalThis & {
  chatMongo?: ChatConnCache;
};

const cached: ChatConnCache = globalWithChat.chatMongo || { conn: null, promise: null };

export async function chatDbConnect(): Promise<Connection> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  const dbName = getChatMongoDbName();

  if (cached.conn && cached.dbName && cached.dbName !== dbName) {
    await cached.conn.close();
    cached.conn = null;
    cached.promise = null;
    cached.dbName = undefined;
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const conn = mongoose.createConnection(MONGODB_URI, {
      dbName,
      bufferCommands: false,
    });
    cached.promise = conn.asPromise().then(() => {
      cached.dbName = dbName;
      return conn;
    });
  }

  cached.conn = await cached.promise;
  globalWithChat.chatMongo = cached;
  return cached.conn;
}

async function getChatModel<T>(name: string, defaultModel: Model<T>): Promise<Model<T>> {
  const conn = await chatDbConnect();
  return (conn.models[name] as Model<T>) || conn.model<T>(name, defaultModel.schema);
}

export async function getChatEmbeddingModel(): Promise<Model<IChatEmbedding>> {
  return getChatModel('ChatEmbedding', ChatEmbedding);
}

export async function getChatRateLimitModel(): Promise<Model<IChatRateLimit>> {
  return getChatModel('ChatRateLimit', ChatRateLimit);
}

export async function getAttorneySearchLogModel(): Promise<Model<IAttorneySearchLog>> {
  return getChatModel('AttorneySearchLog', AttorneySearchLog);
}
