import mongoose, { Schema, Document } from "mongoose";

export interface IRepayment {
  amount: number;
  date: Date;
  notes?: string;
  recordedBy?: string;
}

export interface ILoan extends Document {
  beneficiaryName: string;
  nationalId?: string; // Optional, for linking to Beneficiary model if needed
  phone: string;
  amount: number; // Total loan amount disbursed
  amountPaid: number; // Total amount repaid so far
  status: "active" | "completed" | "defaulted";
  startDate: Date;
  dueDate?: Date;
  repayments: IRepayment[];
  notes?: string;
  createdBy?: string;
  deletedAt?: Date; // Soft delete
  createdAt: Date;
  updatedAt: Date;
}

const RepaymentSchema = new Schema<IRepayment>(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    notes: String,
    recordedBy: String,
  },
  { _id: false }
);

const LoanSchema = new Schema<ILoan>(
  {
    beneficiaryName: { type: String, required: true, trim: true },
    nationalId: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "completed", "defaulted"],
      default: "active",
      index: true,
    },
    startDate: { type: Date, default: Date.now },
    dueDate: Date,
    repayments: [RepaymentSchema],
    notes: String,
    createdBy: String,
    deletedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

// Virtual for remaining amount - logically useful but we might calculate in API
LoanSchema.virtual("remainingAmount").get(function () {
  return this.amount - this.amountPaid;
});

export default mongoose.models.Loan || mongoose.model<ILoan>("Loan", LoanSchema);
