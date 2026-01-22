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
  donorId?: Schema.Types.ObjectId;
  donorNameSnapshot?: string;
  notebookId?: Schema.Types.ObjectId;
  notebookNameSnapshot?: string;
  beneficiaryIds?: Schema.Types.ObjectId[];
  beneficiaryNamesSnapshot?: string[];
  branch?: mongoose.Types.ObjectId; // Reference to Branch model
  branchName?: string; // Cached branch name
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
    donorId: {
      type: Schema.Types.ObjectId,
      ref: "Donor",
      index: true,
    },
    donorNameSnapshot: {
      type: String,
      trim: true,
    },
    notebookId: {
      type: Schema.Types.ObjectId,
      ref: "Notebook",
      index: true,
    },
    notebookNameSnapshot: {
      type: String,
      trim: true,
    },
    beneficiaryIds: {
      type: [Schema.Types.ObjectId],
      ref: "Beneficiary",
      default: [],
      index: true,
    },
    beneficiaryNamesSnapshot: {
      type: [String],
      default: [],
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

export default
  mongoose.models.TreasuryTransaction ||
  mongoose.model<ITreasuryTransaction>(
    "TreasuryTransaction",
    TreasuryTransactionSchema
  );
