import mongoose, { Schema, Document, Model } from 'mongoose';

export type SeedStatus = 'pending' | 'done' | 'failed';

export interface ISeedProgress extends Document {
  itemId: string;
  status: SeedStatus;
  error?: string;
  updatedAt: Date;
}

const SeedProgressSchema = new Schema<ISeedProgress>(
  {
    itemId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'done', 'failed'] satisfies SeedStatus[],
      required: true,
      default: 'pending',
    },
    error: { type: String },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// TTL: automatically clean up records older than 30 days so the collection
// doesn't grow unbounded across repeated seed runs.
SeedProgressSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const SeedProgress: Model<ISeedProgress> =
  (mongoose.models.SeedProgress as Model<ISeedProgress>) ||
  mongoose.model<ISeedProgress>('SeedProgress', SeedProgressSchema);

export default SeedProgress;
