import mongoose, { Document, Schema } from "mongoose";

export const NOTIFICATION_ACTION_TYPES = [
  "beneficiary_created",
  "beneficiary_updated",
  "initiative_created",
  "initiative_updated",
  "treasury_income_created",
  "treasury_expense_created",
  "loan_disbursed",
  "loan_repayment_created",
  "warehouse_movement_in",
  "warehouse_movement_out",
] as const;

export type NotificationActionType = (typeof NOTIFICATION_ACTION_TYPES)[number];

export interface INotification extends Document {
  actionType: NotificationActionType;
  message: string;
  actorUserId?: string;
  actorName: string;
  branch?: mongoose.Types.ObjectId | null;
  branchName?: string | null;
  entityId?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

const NotificationSchema = new Schema<INotification>(
  {
    actionType: {
      type: String,
      enum: NOTIFICATION_ACTION_TYPES,
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    actorUserId: {
      type: String,
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
    branchName: {
      type: String,
      trim: true,
      default: null,
    },
    entityId: {
      type: String,
      trim: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + THIRTY_DAYS_IN_MS),
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ branch: 1, createdAt: -1 });

export default
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);
