import { computeNationalIdBlindIndex } from "./crypto";
import {
  APPLICANT_RELATIONSHIP_TYPES,
  type ApplicantRelationshipType,
  type AssistanceCategory,
  REQUEST_STATUSES,
  type RequestStatus,
  STATUS_PRIORITY_MAP,
  VERIFICATION_STATUSES,
  type VerificationStatus,
} from "./types";

export function computeStatusPriority(status: RequestStatus): number {
  return STATUS_PRIORITY_MAP[status] ?? 4;
}

export function sortRequestsByWorkflowPriority<
  T extends { status: RequestStatus; createdAt: Date | string }
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const prioDiff = computeStatusPriority(a.status) - computeStatusPriority(b.status);
    if (prioDiff !== 0) return prioDiff;

    const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return timeB - timeA;
  });
}

export interface AdminRequestFilters {
  searchName?: string;
  searchPhone?: string;
  searchNationalId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  verificationStatus?: string;
  relationshipType?: string;
  assignedReviewerId?: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a MongoDB filter object from admin search/filter inputs.
 * Converts any exact National ID filter into its keyed HMAC blind index without
 * logging or storing plaintext values in query URLs.
 */
export function buildAdminRequestsFilterQuery(
  filters: AdminRequestFilters,
  branchFilter: Record<string, unknown> = {}
): Record<string, unknown> {
  const andConditions: Record<string, unknown>[] = [];

  if (Object.keys(branchFilter).length > 0) {
    andConditions.push(branchFilter);
  }

  const name = filters.searchName?.trim();
  if (name) {
    andConditions.push({
      fullName: { $regex: escapeRegex(name), $options: "i" },
    });
  }

  const phone = filters.searchPhone?.trim();
  if (phone) {
    andConditions.push({
      $or: [
        { phone: { $regex: escapeRegex(phone) } },
        { whatsapp: { $regex: escapeRegex(phone) } },
      ],
    });
  }

  const nationalId = filters.searchNationalId?.trim();
  if (nationalId) {
    andConditions.push({
      nationalIdBlindIndex: computeNationalIdBlindIndex(nationalId),
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    const dateRange: Record<string, Date> = {};
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      if (!Number.isNaN(from.getTime())) {
        from.setHours(0, 0, 0, 0);
        dateRange.$gte = from;
      }
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        dateRange.$lte = to;
      }
    }
    if (Object.keys(dateRange).length > 0) {
      andConditions.push({ createdAt: dateRange });
    }
  }

  if (filters.status && REQUEST_STATUSES.includes(filters.status as RequestStatus)) {
    andConditions.push({ status: filters.status });
  }

  if (
    filters.verificationStatus &&
    VERIFICATION_STATUSES.includes(filters.verificationStatus as VerificationStatus)
  ) {
    andConditions.push({ verificationStatus: filters.verificationStatus });
  }

  if (
    filters.relationshipType &&
    APPLICANT_RELATIONSHIP_TYPES.includes(
      filters.relationshipType as ApplicantRelationshipType
    )
  ) {
    andConditions.push({ relationshipType: filters.relationshipType });
  }

  const reviewerId = filters.assignedReviewerId?.trim();
  if (reviewerId) {
    if (reviewerId === "__unassigned__") {
      andConditions.push({
        $or: [
          { assignedReviewerId: { $exists: false } },
          { assignedReviewerId: null },
          { assignedReviewerId: "" },
        ],
      });
    } else {
      andConditions.push({ assignedReviewerId: reviewerId });
    }
  }

  if (andConditions.length === 0) return {};
  if (andConditions.length === 1) return andConditions[0];
  return { $and: andConditions };
}

export interface StatusHistoryEntry {
  previousStatus: RequestStatus | null;
  newStatus: RequestStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  note?: string;
}

export interface TransitionState {
  status: RequestStatus;
  statusPriority: number;
  version: number;
  statusHistory: StatusHistoryEntry[];
}

export type TransitionOutcome =
  | {
      ok: true;
      nextStatus: RequestStatus;
      nextStatusPriority: number;
      nextVersion: number;
      historyEntry: StatusHistoryEntry;
      updatedHistory: StatusHistoryEntry[];
    }
  | {
      ok: false;
      status: 400 | 409;
      error: string;
    };

export function applyStatusTransition(
  current: TransitionState,
  params: {
    newStatus: RequestStatus;
    actorId: string;
    actorName: string;
    note?: string;
    expectedVersion?: number;
    now?: Date;
  }
): TransitionOutcome {
  if (!REQUEST_STATUSES.includes(params.newStatus)) {
    return {
      ok: false,
      status: 400,
      error: "حالة الطلب المطلوبة غير صالحة",
    };
  }

  if (
    typeof params.expectedVersion === "number" &&
    params.expectedVersion !== current.version
  ) {
    return {
      ok: false,
      status: 409,
      error: "تم تعديل هذا الطلب بواسطة مسؤول آخر، يرجى تحديث الصفحة",
    };
  }

  const now = params.now ?? new Date();
  const historyEntry: StatusHistoryEntry = {
    previousStatus: current.status,
    newStatus: params.newStatus,
    changedBy: params.actorId,
    changedByName: params.actorName,
    changedAt: now,
    note: params.note?.trim() || undefined,
  };

  return {
    ok: true,
    nextStatus: params.newStatus,
    nextStatusPriority: computeStatusPriority(params.newStatus),
    nextVersion: current.version + 1,
    historyEntry,
    updatedHistory: [...current.statusHistory, historyEntry],
  };
}

export const DUPLICATE_IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

export function checkDuplicateSubmissionWindow(
  recentSameApplicantRequests: Array<{
    _id: unknown;
    assistanceCategory: AssistanceCategory | string;
    description: string;
    status: RequestStatus;
    createdAt: Date | string;
  }>,
  incoming: {
    assistanceCategory: AssistanceCategory;
    description: string;
    now?: Date;
  }
): {
  isIdempotentDuplicate: boolean;
  hasOpenOtherRequest: boolean;
} {
  const nowMs = (incoming.now ?? new Date()).getTime();
  let isIdempotentDuplicate = false;
  let hasOpenOtherRequest = false;

  for (const req of recentSameApplicantRequests) {
    const createdMs =
      req.createdAt instanceof Date
        ? req.createdAt.getTime()
        : new Date(req.createdAt).getTime();

    const withinWindow =
      !Number.isNaN(createdMs) && nowMs - createdMs <= DUPLICATE_IDEMPOTENCY_WINDOW_MS;

    if (
      withinWindow &&
      req.assistanceCategory === incoming.assistanceCategory &&
      req.description.trim() === incoming.description.trim()
    ) {
      isIdempotentDuplicate = true;
    } else if (req.status === "new" || req.status === "under_review") {
      hasOpenOtherRequest = true;
    }
  }

  return {
    isIdempotentDuplicate,
    hasOpenOtherRequest,
  };
}
