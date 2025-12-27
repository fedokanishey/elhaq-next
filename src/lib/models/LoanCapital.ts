import mongoose, { Schema, Document } from "mongoose";

export interface ILoanCapital extends Document {
  amount: number;
  date: Date;
  source: string;
  notes?: string;
  recordedBy?: string;
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
  },
  { timestamps: true }
);

export default mongoose.models.LoanCapital ||
  mongoose.model<ILoanCapital>("LoanCapital", LoanCapitalSchema);
