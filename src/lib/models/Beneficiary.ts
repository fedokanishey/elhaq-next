import mongoose, { Schema, Document } from 'mongoose';

export interface IChild extends Document {
  name: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female';
  idNumber?: string;
}

const ChildSchema = new Schema<IChild>(
  {
    name: { type: String, required: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female'] },
    idNumber: String,
  },
  { timestamps: true }
);

export interface IBeneficiary extends Document {
  clerkId: string;
  name: string;
  nationalId: string;
  phone: string;
  email?: string;
  address: string;
  familyMembers: number;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  income?: number;
  priority: number; // 1-10
  profileImage?: string;
  idImage?: string;
  notes?: string;
  children: IChild[];
  createdAt: Date;
  updatedAt: Date;
}

const BeneficiarySchema = new Schema<IBeneficiary>(
  {
    clerkId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    nationalId: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    email: String,
    address: { type: String, required: true },
    familyMembers: { type: Number, default: 1 },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed'],
      default: 'single',
    },
    income: Number,
    priority: { type: Number, min: 1, max: 10, default: 5 },
    profileImage: String,
    idImage: String,
    notes: String,
    children: [ChildSchema],
  },
  { timestamps: true }
);

export default mongoose.models.Beneficiary ||
  mongoose.model<IBeneficiary>('Beneficiary', BeneficiarySchema);
