import mongoose, { Schema, Document, Model } from 'mongoose';
import { EMBEDDING_DIMENSIONS } from 'src/lib/chat/embeddings';

export interface IChatEmbedding extends Document {
  itemId: string;
  language: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  templateType: string;
  title: string;
  url: string;
  /** Practice area titles — stored on every chunk for pre-filtering. */
  relatedPractices: string[];
  /** Location titles — stored on every chunk for pre-filtering. */
  relatedLocations: string[];
  createdAt: Date;
}

const ChatEmbeddingSchema = new Schema<IChatEmbedding>(
  {
    itemId: { type: String, required: true },
    language: { type: String, required: true, default: 'en' },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) => v.length === EMBEDDING_DIMENSIONS,
        message: `Embedding must have exactly ${EMBEDDING_DIMENSIONS} dimensions`,
      },
    },
    templateType: { type: String, required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    relatedPractices: { type: [String], default: [] },
    relatedLocations: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound index for efficient delete-then-insert upsert (replaces all chunks per item+language)
ChatEmbeddingSchema.index({ itemId: 1, language: 1 });

// Index for templateType pre-filtering (used alongside vector search)
ChatEmbeddingSchema.index({ templateType: 1 });

// Prevent model re-registration in Next.js hot-reload
const ChatEmbedding: Model<IChatEmbedding> =
  (mongoose.models.ChatEmbedding as Model<IChatEmbedding>) ||
  mongoose.model<IChatEmbedding>('ChatEmbedding', ChatEmbeddingSchema);

export default ChatEmbedding;
