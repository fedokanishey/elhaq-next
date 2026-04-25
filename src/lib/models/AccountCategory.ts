import mongoose, { Document, Schema } from "mongoose";

export interface IAccountCategory extends Document {
  name: string;
  normalizedName: string;
  branch?: mongoose.Types.ObjectId | null;
  branchName?: string | null;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountCategorySchema = new Schema<IAccountCategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },
    branchName: {
      type: String,
      trim: true,
      default: null,
    },
    createdBy: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AccountCategorySchema.index({ normalizedName: 1, branch: 1 }, { unique: true });

export default
  mongoose.models.AccountCategory ||
  mongoose.model<IAccountCategory>("AccountCategory", AccountCategorySchema);
