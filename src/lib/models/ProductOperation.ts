import mongoose, { Schema, Document } from "mongoose";

export interface IProductOperation extends Document {
  product: mongoose.Types.ObjectId;
  type: "purchase" | "expense" | "sale" | "transform" | "donation";
  description: string;
  quantity?: number;
  amount: number;
  amountType: "cost" | "revenue";
  
  // For transform operations
  targetProduct?: mongoose.Types.ObjectId;
  targetQuantity?: number;
  
  // For byproduct sales
  byproductName?: string;
  byproductQuantity?: number;
  
  date: Date;
  recordedBy?: string;
  branch?: mongoose.Types.ObjectId;
  branchName?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProductOperationSchema = new Schema<IProductOperation>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["purchase", "expense", "sale", "transform", "donation"],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    amountType: {
      type: String,
      enum: ["cost", "revenue"],
      required: true,
    },
    
    // Transform fields
    targetProduct: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    targetQuantity: { type: Number, min: 0 },
    
    // Byproduct fields
    byproductName: { type: String, trim: true },
    byproductQuantity: { type: Number, min: 0 },
    
    date: { type: Date, default: Date.now, index: true },
    recordedBy: String,
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    branchName: { type: String, trim: true },
    deletedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

// Compound index for efficient queries
ProductOperationSchema.index({ product: 1, date: -1 });
ProductOperationSchema.index({ product: 1, type: 1 });

// Force model recompilation in dev mode
if (process.env.NODE_ENV === "development") {
  delete mongoose.models.ProductOperation;
}

export default mongoose.models.ProductOperation ||
  mongoose.model<IProductOperation>("ProductOperation", ProductOperationSchema);
