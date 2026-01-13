import mongoose, { Schema, Document } from 'mongoose';

export interface IBranch extends Document {
  name: string;
  code: string; // Unique code for the branch
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    name: { 
      type: String, 
      required: true, 
      unique: true,
      trim: true 
    },
    code: { 
      type: String, 
      required: true, 
      unique: true, 
      uppercase: true,
      trim: true,
      index: true 
    },
    address: { 
      type: String, 
      trim: true 
    },
    phone: { 
      type: String, 
      trim: true 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
  },
  { timestamps: true }
);

export default mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema);
