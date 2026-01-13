import mongoose, { Schema, Document } from "mongoose";

export interface ILoanCapital extends Document {
  amount: number;
  date: Date;
  source: string;
  notes?: string;
  recordedBy?: string;
  branch?: mongoose.Types.ObjectId; // Reference to Branch model
  branchName?: string; // Cached branch name
  createdAt: Date;
  updatedAt: Date;
}

const LoanCapitalSchema = new Schema<ILoanCapital>(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    source: { type: String, required: true, trim: true },
    notes: String,
    recordedBy: String,
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
  { timestamps: true }
);

export default mongoose.models.LoanCapital ||
  mongoose.model<ILoanCapital>("LoanCapital", LoanCapitalSchema);
