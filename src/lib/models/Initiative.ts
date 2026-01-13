import mongoose, { Schema, Document } from 'mongoose';

export interface IInitiative extends Document {
  name: string;
  description: string;
  date: Date;
  totalAmount: number;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  beneficiaries: string[]; // Array of Beneficiary IDs
  images: string[];
  branch?: mongoose.Types.ObjectId; // Reference to Branch model
  branchName?: string; // Cached branch name
  createdAt: Date;
  updatedAt: Date;
}

const InitiativeSchema = new Schema<IInitiative>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['planned', 'active', 'completed', 'cancelled'],
      default: 'planned',
    },
    beneficiaries: [{ type: Schema.Types.ObjectId, ref: 'Beneficiary' }],
    images: {
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
  { timestamps: true }
);

if (mongoose.models.Initiative) {
  mongoose.deleteModel('Initiative');
}

const InitiativeModel = mongoose.model<IInitiative>('Initiative', InitiativeSchema);

export default InitiativeModel;
