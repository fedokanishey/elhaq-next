import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  category: "raw" | "finished" | "byproduct";
  unit: "كيلو" | "طن" | "كرتونة" | "شكارة" | "قطعة";
  currentQuantity: number;
  totalCost: number;
  totalRevenue: number;
  parentProduct?: mongoose.Types.ObjectId;
  status: "active" | "depleted" | "archived";
  notes?: string;
  branch?: mongoose.Types.ObjectId;
  branchName?: string;
  createdBy?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      enum: ["raw", "finished", "byproduct"],
      default: "raw",
      index: true,
    },
    unit: {
      type: String,
      enum: ["كيلو", "طن", "كرتونة", "شكارة", "قطعة"],
      default: "كيلو",
    },
    currentQuantity: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },
    totalRevenue: { type: Number, default: 0, min: 0 },
    parentProduct: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "depleted", "archived"],
      default: "active",
      index: true,
    },
    notes: { type: String, trim: true },
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    branchName: { type: String, trim: true },
    createdBy: String,
    deletedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

// Virtual for net profit/loss
ProductSchema.virtual("netProfit").get(function () {
  return this.totalRevenue - this.totalCost;
});

// Virtual for unit cost
ProductSchema.virtual("unitCost").get(function () {
  if (this.currentQuantity <= 0) return 0;
  return this.totalCost / this.currentQuantity;
});

// Force model recompilation in dev mode
if (process.env.NODE_ENV === "development") {
  delete mongoose.models.Product;
}

export default mongoose.models.Product ||
  mongoose.model<IProduct>("Product", ProductSchema);
