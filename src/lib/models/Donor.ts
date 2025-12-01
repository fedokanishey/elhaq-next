import mongoose, { Document, Schema } from "mongoose";

export interface IDonor extends Document {
  name: string;
  nameNormalized: string;
  totalDonated: number;
  donationsCount: number;
  lastDonationDate?: Date;
  contactPhone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DonorSchema = new Schema<IDonor>(
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
      unique: true,
      index: true,
    },
    totalDonated: {
      type: Number,
      default: 0,
    },
    donationsCount: {
      type: Number,
      default: 0,
    },
    lastDonationDate: {
      type: Date,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Donor || mongoose.model<IDonor>("Donor", DonorSchema);
