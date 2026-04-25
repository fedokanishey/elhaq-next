import mongoose, { Document, Schema } from "mongoose";

export interface INotebook extends Document {
  name: string;
  nameNormalized: string;
  type: "income" | "expense" | "all";
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

// 'type' is a reserved keyword in Mongoose schemas - Mongoose uses it internally
// to declare field types (e.g., { type: String }). When you name a field 'type',
// Mongoose misinterprets the definition as a type declaration, not a data field.
// The fix: add the 'type' path AFTER schema construction using schema.add().
NotebookSchema.add({
  type: {
    type: String,
    enum: ["income", "expense", "all"],
    default: "all",
  }
});

// Compound unique index: same name within the same branch is not allowed
NotebookSchema.index({ nameNormalized: 1, branch: 1 }, { unique: true });

// Delete the cached model so the new schema takes effect on hot reload
if (mongoose.models.Notebook) {
  delete mongoose.models.Notebook;
}

export default mongoose.model<INotebook>("Notebook", NotebookSchema);
