import mongoose, { Schema, Document } from "mongoose";

export interface IWarehouseMovement extends Document {
  type: "inbound" | "outbound";
  category: "cash" | "product";
  itemName?: string; // For tracking specific stock items
  description: string;
  quantity?: number; // Optional if tracking items
  value?: number; // Optional financial value
  date: Date;
  recordedBy?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseMovementSchema = new Schema<IWarehouseMovement>(
  {
    type: {
      type: String,
      enum: ["inbound", "outbound"],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["cash", "product"],
      required: true,
      index: true,
    },
    itemName: { type: String, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    quantity: Number,
    value: Number,
    date: { type: Date, default: Date.now },
    recordedBy: String,
    deletedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

// Force model recompilation in dev mode to ensure new fields are picked up
if (process.env.NODE_ENV === "development") {
  delete mongoose.models.WarehouseMovement;
}

export default mongoose.models.WarehouseMovement ||
  mongoose.model<IWarehouseMovement>("WarehouseMovement", WarehouseMovementSchema);
