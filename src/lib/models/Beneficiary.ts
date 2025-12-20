import mongoose, { Schema, Document, Types } from 'mongoose';

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

export interface ISpouse extends Document {
  name?: string;
  nationalId?: string;
  phone?: string;
  whatsapp?: string;
  income?: number;
  healthStatus?: "healthy" | "sick";
}

const SpouseSchema = new Schema<ISpouse>(
  {
    name: String,
    nationalId: String,
    phone: String,
    whatsapp: String,
    income: Number,
    healthStatus: {
      type: String,
      enum: ["healthy", "sick"],
      default: "healthy",
    },
  },
  { _id: false }
);

export interface IChild extends Document {
  name: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female';
  idNumber?: string;
  nationalId?: string;
  school?: string;
  educationStage?: '' | 'kindergarten' | 'primary' | 'preparatory' | 'secondary' | 'university' | 'other';
  maritalStatus?: MaritalStatus;
  spouse?: ISpouse;
  healthStatus?: 'healthy' | 'sick';
  healthCertificationImage?: string;
}

const ChildSchema = new Schema<IChild>(
  {
    name: { type: String, required: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female'] },
    idNumber: String,
    nationalId: String,
    school: String,
    educationStage: {
      type: String,
      enum: ['kindergarten', 'primary', 'preparatory', 'secondary', 'university', 'other', ''],
      default: '',
    },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed'],
      default: 'single',
    },
    spouse: { type: SpouseSchema, default: undefined },
    healthStatus: {
      type: String,
      enum: ['healthy', 'sick'],
      default: 'healthy',
    },
    healthCertificationImage: String,
  },
  { timestamps: true }
);

export type RelationshipType =
  | 'father'
  | 'mother'
  | 'son'
  | 'daughter'
  | 'brother'
  | 'sister'
  | 'spouse'
  | 'grandfather'
  | 'grandmother'
  | 'other';

export interface IRelationship extends Document {
  relation: RelationshipType;
  relativeName: string;
  relativeNationalId?: string;
  relative?: Types.ObjectId;
}

const RelationshipSchema = new Schema<IRelationship>(
  {
    relation: {
      type: String,
      enum: ['father', 'mother', 'son', 'daughter', 'brother', 'sister', 'spouse', 'grandfather', 'grandmother', 'other'],
      required: true,
    },
    relativeName: { type: String, required: true },
    relativeNationalId: String,
    relative: { type: Schema.Types.ObjectId, ref: 'Beneficiary' },
  },
  { _id: false }
);

export interface IBeneficiary extends Document {
  clerkId: string;
  name: string;
  nationalId: string;
  phone: string;
  whatsapp: string;
  address: string;
  familyMembers: number;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  income?: number;
  priority: number; // 1-10, calculated dynamically
  profileImage?: string;
  idImage?: string;
  notes?: string;
  healthStatus?: 'healthy' | 'sick';
  healthCertificationImage?: string;
  housingType?: 'owned' | 'rented';
  rentalCost?: number;
  employment?: string;
  acceptsMarriage?: boolean;
  marriageDetails?: string;
  marriageCertificateImage?: string;
  // Status fields
  status?: 'active' | 'cancelled' | 'pending';
  statusReason?: string;
  statusDate?: Date;
  listName?: string; // Deprecated: kept for backward compatibility
  listNames?: string[]; // New: supports multiple lists
  receivesMonthlyAllowance?: boolean;
  monthlyAllowanceAmount?: number;
  children: IChild[];
  spouse?: ISpouse;
  relationships: IRelationship[];
  createdAt: Date;
  updatedAt: Date;
}

const BeneficiarySchema = new Schema<IBeneficiary>(
  {
    clerkId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    nationalId: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    whatsapp: { type: String, required: true },
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
    healthStatus: {
      type: String,
      enum: ['healthy', 'sick'],
      default: 'healthy',
    },
    healthCertificationImage: String,
    housingType: {
      type: String,
      enum: ['owned', 'rented'],
      default: 'owned',
    },
    rentalCost: Number,
    employment: String,
    acceptsMarriage: { type: Boolean, default: false },
    marriageDetails: String,
    marriageCertificateImage: { type: String, default: '' },
    // Status fields
    status: {
      type: String,
      enum: ['active', 'cancelled', 'pending'],
      default: 'active',
    },
    statusReason: String,
    statusDate: Date,
    listName: { type: String }, // Deprecated: kept for backward compatibility
    listNames: { type: [String], default: ['الكشف العام'] }, // New: supports multiple lists
    receivesMonthlyAllowance: { type: Boolean, default: false },
    monthlyAllowanceAmount: Number,
    children: [ChildSchema],
    spouse: { type: SpouseSchema, default: undefined },
    relationships: { type: [RelationshipSchema], default: [] },
  },
  { timestamps: true, strict: false }
);

if (mongoose.models.Beneficiary) {
  mongoose.deleteModel('Beneficiary');
}

const Beneficiary = mongoose.model<IBeneficiary>('Beneficiary', BeneficiarySchema);

export default Beneficiary;
