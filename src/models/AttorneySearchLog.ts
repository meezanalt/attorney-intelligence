import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAttorneySearchMatchLog {
  itemId: string;
  name: string;
  matchScore?: number;
  reasoning?: string;
  url: string;
}

export interface IAttorneySearchLog extends Document {
  query: string;
  practiceFilter?: string;
  locationFilter?: string;
  matches: IAttorneySearchMatchLog[];
  scored: boolean;
  searchNote?: string;
  ipHash: string;
  durationMs: number;
  createdAt: Date;
}

const MatchLogSchema = new Schema<IAttorneySearchMatchLog>(
  {
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    matchScore: { type: Number },
    reasoning: { type: String },
    url: { type: String, default: '' },
  },
  { _id: false }
);

const AttorneySearchLogSchema = new Schema<IAttorneySearchLog>(
  {
    query: { type: String, required: true },
    practiceFilter: { type: String },
    locationFilter: { type: String },
    matches: { type: [MatchLogSchema], default: [] },
    scored: { type: Boolean, required: true, default: false },
    searchNote: { type: String },
    ipHash: { type: String, required: true },
    durationMs: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AttorneySearchLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AttorneySearchLog: Model<IAttorneySearchLog> =
  (mongoose.models.AttorneySearchLog as Model<IAttorneySearchLog>) ||
  mongoose.model<IAttorneySearchLog>('AttorneySearchLog', AttorneySearchLogSchema);

export default AttorneySearchLog;
