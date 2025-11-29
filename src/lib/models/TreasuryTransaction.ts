import mongoose, { Schema, Document } from "mongoose";

export interface ITreasuryTransaction extends Document {
  type: "income" | "expense";
  amount: number;
  description: string;
  category?: string;
  reference?: string;
  transactionDate: Date;
  createdBy?: string;
  recordedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TreasuryTransactionSchema = new Schema<ITreasuryTransaction>(
  {
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "general",
      trim: true,
    },
    reference: {
      type: String,
      trim: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdBy: {
      type: String,
      index: true,
    },
    recordedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default
  mongoose.models.TreasuryTransaction ||
  mongoose.model<ITreasuryTransaction>(
    "TreasuryTransaction",
    TreasuryTransactionSchema
  );
