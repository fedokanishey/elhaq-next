import mongoose, { Schema, Document, Types } from "mongoose";

export type MarriageRelationship = "daughter" | "son" | "self" | "other";
export type MarriageCaseStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface IProvidedItem {
  itemName: string;
  quantity: number;
  cost?: number;
  notes?: string;
  deliveredAt?: Date;
}

export interface IMarriageCase extends Document {
  beneficiary: Types.ObjectId;
  beneficiaryName: string;
  beneficiaryNationalId?: string;
  beneficiaryPhone?: string;
  beneficiaryAddress?: string;

  personName: string;
  relationship: MarriageRelationship;
  nationalId?: string;
  phone?: string;
  spouseName?: string;

  marriageDate?: Date;
  status: MarriageCaseStatus;

  itemsProvided: IProvidedItem[];
  cashAssistance?: number;
  totalCost: number;

  certificateImage?: string;
  notes?: string;

  branch?: Types.ObjectId;
  branchName?: string;
  createdBy?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProvidedItemSchema = new Schema<IProvidedItem>(
  {
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    cost: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
    deliveredAt: { type: Date },
  },
  { _id: false }
);

const MarriageCaseSchema = new Schema<IMarriageCase>(
  {
    beneficiary: {
      type: Schema.Types.ObjectId,
      ref: "Beneficiary",
      required: true,
      index: true,
    },
    beneficiaryName: {
      type: String,
      required: true,
      trim: true,
    },
    beneficiaryNationalId: {
      type: String,
      trim: true,
    },
    beneficiaryPhone: {
      type: String,
      trim: true,
    },
    beneficiaryAddress: {
      type: String,
      trim: true,
    },
    personName: {
      type: String,
      required: true,
      trim: true,
    },
    relationship: {
      type: String,
      enum: ["daughter", "son", "self", "other"],
      default: "daughter",
      index: true,
    },
    nationalId: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    spouseName: {
      type: String,
      trim: true,
    },
    marriageDate: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    itemsProvided: {
      type: [ProvidedItemSchema],
      default: [],
    },
    cashAssistance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    certificateImage: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    branchName: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: String,
      trim: true,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying cases by branch and status
MarriageCaseSchema.index({ branch: 1, status: 1 });
MarriageCaseSchema.index({ beneficiary: 1, createdAt: -1 });

// Avoid model overwrite in Next.js development hot reloading
export default (mongoose.models.MarriageCase ||
  mongoose.model<IMarriageCase>("MarriageCase", MarriageCaseSchema)) as any;

