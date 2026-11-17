import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { sanitizeAuditDetails } from "@/lib/assistance/auth";
import type { AssistanceAuditAction } from "@/lib/assistance/types";

export const ASSISTANCE_AUDIT_ACTIONS: readonly AssistanceAuditAction[] = [
  "status_changed",
  "note_added",
  "national_id_revealed",
  "manual_verification_resolved",
  "verification_rerun",
  "reviewer_assigned",
] as const;

export interface IAssistanceAuditLog extends Document {
  requestId: Types.ObjectId;
  action: AssistanceAuditAction;
  actorId: string;
  actorName: string;
  branch?: Types.ObjectId | null;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const AssistanceAuditLogSchema = new Schema<IAssistanceAuditLog>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: "AssistanceRequest",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ASSISTANCE_AUDIT_ACTIONS,
      required: true,
      index: true,
    },
    actorId: {
      type: String,
      required: true,
      index: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Defense-in-depth: strip any National ID fields from audit metadata before saving
AssistanceAuditLogSchema.pre("save", function () {
  if (this.details && typeof this.details === "object") {
    this.details = sanitizeAuditDetails(this.details as Record<string, unknown>);
  }
});

AssistanceAuditLogSchema.index({ requestId: 1, createdAt: -1 });
AssistanceAuditLogSchema.index({ actorId: 1, createdAt: -1 });

const AssistanceAuditLog: Model<IAssistanceAuditLog> =
  mongoose.models.AssistanceAuditLog ||
  mongoose.model<IAssistanceAuditLog>("AssistanceAuditLog", AssistanceAuditLogSchema);

export default AssistanceAuditLog;
