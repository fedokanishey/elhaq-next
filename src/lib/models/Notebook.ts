import mongoose, { Document, Schema } from "mongoose";

export interface INotebook extends Document {
  name: string;
  nameNormalized: string;
  transactionsCount: number;
  totalAmount: number;
  lastUsedDate?: Date;
  notes?: string;
  branch?: mongoose.Types.ObjectId;
  branchName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotebookSchema = new Schema<INotebook>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameNormalized: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    transactionsCount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    lastUsedDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    branch: { 
      type: Schema.Types.ObjectId, 
      ref: 'Branch',
      index: true 
    },
    branchName: {
      type: String,
      trim: true
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: same name within the same branch is not allowed
NotebookSchema.index({ nameNormalized: 1, branch: 1 }, { unique: true });

export default mongoose.models.Notebook || mongoose.model<INotebook>("Notebook", NotebookSchema);
