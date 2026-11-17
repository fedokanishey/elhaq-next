import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  APPLICANT_RELATIONSHIP_TYPES,
  ASSISTANCE_CATEGORIES,
  MARITAL_STATUS_VALUES,
  REQUEST_STATUSES,
  VERIFICATION_STATUSES,
  type ApplicantMaritalStatus,
  type ApplicantRelationshipType,
  type AssistanceCategory,
  type BeneficiarySnapshot,
  type CandidateMatchSummary,
  type MatchedPersonInfo,
  type RequestStatus,
  type VerificationStatus,
  type VerificationWarningCode,
} from "@/lib/assistance/types";

export interface IAssistanceAdminNote {
  _id?: Types.ObjectId;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export interface IAssistanceStatusHistoryEntry {
  _id?: Types.ObjectId;
  previousStatus: RequestStatus | null;
  newStatus: RequestStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  note?: string;
}

export interface IManualVerificationResolution {
  resolvedBy: string;
  resolvedByName: string;
  resolvedAt: Date;
  decisionNote: string;
  chosenBeneficiaryId?: Types.ObjectId | null;
  chosenVerificationStatus: VerificationStatus;
  chosenRelationshipType: ApplicantRelationshipType;
}

export interface IAssistanceRequest extends Document {
  fullName: string;
  nationalIdEncrypted: string;
  nationalIdBlindIndex: string;
  nationalIdMasked: string;
  phone: string;
  whatsapp?: string;
  address: string;
  familyMembersCount?: number;
  maritalStatus?: ApplicantMaritalStatus;
  monthlyIncome?: number;
  assistanceCategory: AssistanceCategory;
  description: string;
  attachments: string[];
  submittedByClerkId?: string | null;

  verificationStatus: VerificationStatus;
  relationshipType: ApplicantRelationshipType;
  beneficiary?: Types.ObjectId | null;
  beneficiarySnapshot?: BeneficiarySnapshot | null;
  matchedPerson?: MatchedPersonInfo | null;
  verificationWarnings: VerificationWarningCode[];
  candidateMatches: CandidateMatchSummary[];
  verifiedAt?: Date;
  manualResolution?: IManualVerificationResolution | null;

  status: RequestStatus;
  statusPriority: number;
  assignedReviewerId?: string | null;
  assignedReviewerName?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: Date | null;
  adminNotes: IAssistanceAdminNote[];
  statusHistory: IAssistanceStatusHistoryEntry[];

  branch?: Types.ObjectId | null;
  branchName?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const MatchedPersonSchema = new Schema<MatchedPersonInfo>(
  {
    name: { type: String, trim: true },
    personType: {
      type: String,
      enum: ["primary", "spouse", "child", "child_spouse", "relative"],
      required: true,
    },
    subId: { type: String, trim: true },
    specificRelation: { type: String, trim: true },
    gender: { type: String, enum: ["male", "female"] },
    relatedViaName: { type: String, trim: true },
  },
  { _id: false }
);

const BeneficiarySnapshotSchema = new Schema<BeneficiarySnapshot>(
  {
    name: { type: String, required: true, trim: true },
    internalId: { type: String, trim: true },
    status: { type: String, trim: true },
    branchId: { type: String, trim: true },
    branchName: { type: String, trim: true },
  },
  { _id: false }
);

const CandidateMatchSchema = new Schema<CandidateMatchSummary>(
  {
    beneficiaryId: { type: String, required: true },
    beneficiaryName: { type: String, required: true },
    beneficiaryInternalId: { type: String },
    beneficiaryStatus: { type: String },
    branchName: { type: String },
    verificationType: {
      type: String,
      enum: [
        "matched_primary_beneficiary",
        "matched_spouse",
        "matched_child",
        "matched_other_dependent",
      ],
      required: true,
    },
    relationshipType: {
      type: String,
      enum: [
        "primary_beneficiary",
        "beneficiary_spouse",
        "beneficiary_child",
        "other_dependent",
      ],
      required: true,
    },
    matchedPerson: { type: MatchedPersonSchema, required: true },
    warnings: { type: [String], default: [] },
  },
  { _id: false }
);

const AdminNoteSchema = new Schema<IAssistanceAdminNote>(
  {
    content: { type: String, required: true, trim: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const StatusHistorySchema = new Schema<IAssistanceStatusHistoryEntry>(
  {
    previousStatus: {
      type: String,
      enum: [...REQUEST_STATUSES, null],
      default: null,
    },
    newStatus: {
      type: String,
      enum: REQUEST_STATUSES,
      required: true,
    },
    changedBy: { type: String, required: true },
    changedByName: { type: String, required: true, trim: true },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true },
  },
  { _id: true }
);

const ManualResolutionSchema = new Schema<IManualVerificationResolution>(
  {
    resolvedBy: { type: String, required: true },
    resolvedByName: { type: String, required: true, trim: true },
    resolvedAt: { type: Date, required: true },
    decisionNote: { type: String, required: true, trim: true },
    chosenBeneficiaryId: { type: Schema.Types.ObjectId, ref: "Beneficiary", default: null },
    chosenVerificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      required: true,
    },
    chosenRelationshipType: {
      type: String,
      enum: APPLICANT_RELATIONSHIP_TYPES,
      required: true,
    },
  },
  { _id: false }
);

const AssistanceRequestSchema = new Schema<IAssistanceRequest>(
  {
    fullName: { type: String, required: true, trim: true },
    nationalIdEncrypted: { type: String, required: true },
    nationalIdBlindIndex: { type: String, required: true, index: true },
    nationalIdMasked: { type: String, required: true },
    phone: { type: String, required: true, trim: true, index: true },
    whatsapp: { type: String, trim: true },
    address: { type: String, required: true, trim: true },
    familyMembersCount: { type: Number, min: 1 },
    maritalStatus: {
      type: String,
      enum: MARITAL_STATUS_VALUES,
    },
    monthlyIncome: { type: Number, min: 0 },
    assistanceCategory: {
      type: String,
      enum: ASSISTANCE_CATEGORIES,
      required: true,
    },
    description: { type: String, required: true, trim: true },
    attachments: { type: [String], default: [] },
    submittedByClerkId: { type: String, default: null, index: true },

    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      required: true,
      index: true,
    },
    relationshipType: {
      type: String,
      enum: APPLICANT_RELATIONSHIP_TYPES,
      required: true,
      index: true,
    },
    beneficiary: {
      type: Schema.Types.ObjectId,
      ref: "Beneficiary",
      default: null,
      index: true,
    },
    beneficiarySnapshot: {
      type: BeneficiarySnapshotSchema,
      default: null,
    },
    matchedPerson: {
      type: MatchedPersonSchema,
      default: null,
    },
    verificationWarnings: { type: [String], default: [] },
    candidateMatches: { type: [CandidateMatchSchema], default: [] },
    verifiedAt: { type: Date },
    manualResolution: { type: ManualResolutionSchema, default: null },

    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: "new",
      index: true,
    },
    statusPriority: {
      type: Number,
      default: 1,
      index: true,
    },
    assignedReviewerId: { type: String, default: null, index: true },
    assignedReviewerName: { type: String, default: null, trim: true },
    reviewedBy: { type: String, default: null },
    reviewedByName: { type: String, default: null, trim: true },
    reviewedAt: { type: Date, default: null },
    adminNotes: { type: [AdminNoteSchema], default: [] },
    statusHistory: { type: [StatusHistorySchema], default: [] },

    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },
    branchName: { type: String, trim: true, default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

AssistanceRequestSchema.index({ statusPriority: 1, createdAt: -1 });
AssistanceRequestSchema.index({ branch: 1, statusPriority: 1, createdAt: -1 });
AssistanceRequestSchema.index({ nationalIdBlindIndex: 1, createdAt: -1 });
AssistanceRequestSchema.index({ beneficiary: 1, createdAt: -1 });
AssistanceRequestSchema.index({ verificationStatus: 1, statusPriority: 1, createdAt: -1 });

const AssistanceRequest: Model<IAssistanceRequest> =
  mongoose.models.AssistanceRequest ||
  mongoose.model<IAssistanceRequest>("AssistanceRequest", AssistanceRequestSchema);

export default AssistanceRequest;
