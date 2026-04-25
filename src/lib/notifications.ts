import { isValidObjectId, Types } from "mongoose";
import type { AuthResult } from "@/lib/auth-helpers";
import Notification, { NotificationActionType } from "@/lib/models/Notification";

const toBranchObjectId = (value?: string | Types.ObjectId | null) => {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === "string" && isValidObjectId(value)) {
    return new Types.ObjectId(value);
  }
  return null;
};

export const getActorName = (authResult: AuthResult, fallback?: string) => {
  const firstName = authResult.user?.firstName?.trim() || "";
  const lastName = authResult.user?.lastName?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || fallback?.trim() || "مسؤول الفرع";
};

export async function createActivityNotification(params: {
  authResult: AuthResult;
  actionType: NotificationActionType;
  message: string;
  actorName?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  branch?: string | Types.ObjectId | null;
  branchName?: string | null;
}) {
  if (!params.authResult.userId) {
    return null;
  }

  // Requirement scope: branch admin actions monitored by members.
  if (!params.authResult.isAdmin && !params.authResult.isSuperAdmin) {
    return null;
  }

  const actorName = getActorName(params.authResult, params.actorName);
  const branch = toBranchObjectId(params.branch ?? params.authResult.branch);

  return Notification.create({
    actionType: params.actionType,
    message: params.message,
    actorUserId: params.authResult.userId,
    actorName,
    entityId: params.entityId,
    metadata: params.metadata,
    branch,
    branchName: params.branchName ?? params.authResult.branchName,
  });
}
