import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChatRateLimit extends Document {
  /** Fixed-window bucket key: chat:rl:{ipHash}:{minuteBucket} */
  key: string;
  count: number;
  createdAt: Date;
}

const ChatRateLimitSchema = new Schema<IChatRateLimit>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

// Housekeeping only — bucket lifetime is 60 s; 90 s TTL ensures stale docs are removed.
ChatRateLimitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 });

const ChatRateLimit: Model<IChatRateLimit> =
  (mongoose.models.ChatRateLimit as Model<IChatRateLimit>) ||
  mongoose.model<IChatRateLimit>('ChatRateLimit', ChatRateLimitSchema);

export default ChatRateLimit;
