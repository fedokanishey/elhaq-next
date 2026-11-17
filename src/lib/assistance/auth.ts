import type { UserRole } from "@/lib/models/User";

export interface MinimalAuthCheckInput {
  userId: string | null;
  role: UserRole;
  branchId: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isMember: boolean;
}

export type AdminAccessDecision =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
    };

/**
 * Pure authorization check enforcing least-privilege admin access and branch isolation.
 * Only `admin` (same branch) and `superadmin` are allowed.
 * Normal `user`, `member`, unauthenticated callers, and cross-branch admins are strictly denied.
 */
export function evaluateAssistanceAdminAccess(
  authInput: MinimalAuthCheckInput,
  options?: { resourceBranchId?: string | null }
): AdminAccessDecision {
  if (!authInput.userId) {
    return {
      ok: false,
      status: 401,
      error: "غير مصرح — يرجى تسجيل الدخول",
    };
  }

  if ((!authInput.isAdmin && !authInput.isSuperAdmin) || authInput.isMember) {
    return {
      ok: false,
      status: 403,
      error: "ممنوع الوصول — هذه الصفحة مخصصة للمسؤولين فقط",
    };
  }

  if (
    !authInput.isSuperAdmin &&
    options?.resourceBranchId &&
    authInput.branchId &&
    options.resourceBranchId !== authInput.branchId
  ) {
    return {
      ok: false,
      status: 403,
      error: "ممنوع الوصول لبيانات فرع آخر",
    };
  }

  if (!authInput.isSuperAdmin && options?.resourceBranchId && !authInput.branchId) {
    return {
      ok: false,
      status: 403,
      error: "ممنوع الوصول — حساب المسؤول غير مرتبط بفرع",
    };
  }

  return { ok: true };
}

/**
 * Pure authorization check enforcing read-only or management access to Assistance Requests.
 * Allowed: `superadmin` (all branches), `admin` (same branch), and `member` (same branch, read-only UI/API).
 * Normal `user`, unauthenticated callers, and cross-branch admins/members are strictly denied.
 */
export function evaluateAssistanceReadAccess(
  authInput: MinimalAuthCheckInput,
  options?: { resourceBranchId?: string | null }
): AdminAccessDecision {
  if (!authInput.userId) {
    return {
      ok: false,
      status: 401,
      error: "غير مصرح — يرجى تسجيل الدخول",
    };
  }

  if (!authInput.isSuperAdmin && !authInput.isAdmin && !authInput.isMember) {
    return {
      ok: false,
      status: 403,
      error: "ممنوع الوصول — هذه الصفحة مخصصة للمسؤولين والأعضاء فقط",
    };
  }

  if (!authInput.isSuperAdmin && options?.resourceBranchId && !authInput.branchId) {
    return {
      ok: false,
      status: 403,
      error: "ممنوع الوصول — حسابك غير مرتبط بفرع",
    };
  }

  if (
    !authInput.isSuperAdmin &&
    options?.resourceBranchId &&
    authInput.branchId &&
    options.resourceBranchId !== authInput.branchId
  ) {
    return {
      ok: false,
      status: 403,
      error: "ممنوع الوصول لبيانات فرع آخر",
    };
  }

  return { ok: true };
}

/**
 * Pure authorization check enforcing regular-user-only questionnaire access (`role === 'user'`).
 * Unauthenticated users, committee members (`member`), admins, and superadmins are denied.
 */
export function evaluateAssistanceUserSubmitAccess(
  authInput: MinimalAuthCheckInput
): AdminAccessDecision {
  if (!authInput.userId) {
    return {
      ok: false,
      status: 401,
      error: "غير مصرح — يرجى تسجيل الدخول أولاً",
    };
  }

  if (
    authInput.role !== "user" ||
    authInput.isAdmin ||
    authInput.isSuperAdmin ||
    authInput.isMember
  ) {
    return {
      ok: false,
      status: 403,
      error: "ممنوع الوصول — استبيان طلب المساعدة مخصص للمستخدمين فقط",
    };
  }

  return { ok: true };
}

export async function requireAssistanceRegularUser() {
  const { getAuthenticatedUser } = await import("@/lib/auth-helpers");
  const authResult = await getAuthenticatedUser();

  const decision = evaluateAssistanceUserSubmitAccess({
    userId: authResult.userId,
    role: authResult.role,
    branchId: authResult.branch ? authResult.branch.toString() : null,
    isSuperAdmin: authResult.isSuperAdmin,
    isAdmin: authResult.isAdmin,
    isMember: authResult.isMember,
  });

  if (!decision.ok) {
    return {
      ok: false as const,
      status: decision.status,
      error: decision.error,
    };
  }

  return {
    ok: true as const,
    authResult,
  };
}

export async function requireAssistanceReadAccess(options?: {
  resourceBranchId?: { toString(): string } | string | null;
}) {
  const [{ getAuthenticatedUser }, { getActorName }] = await Promise.all([
    import("@/lib/auth-helpers"),
    import("@/lib/notifications"),
  ]);

  const authResult = await getAuthenticatedUser();
  const resourceBranchStr = options?.resourceBranchId
    ? options.resourceBranchId.toString()
    : null;

  const decision = evaluateAssistanceReadAccess(
    {
      userId: authResult.userId,
      role: authResult.role,
      branchId: authResult.branch ? authResult.branch.toString() : null,
      isSuperAdmin: authResult.isSuperAdmin,
      isAdmin: authResult.isAdmin,
      isMember: authResult.isMember,
    },
    { resourceBranchId: resourceBranchStr }
  );

  if (!decision.ok) {
    return {
      ok: false as const,
      status: decision.status,
      error: decision.error,
    };
  }

  return {
    ok: true as const,
    authResult,
    actorName: getActorName(authResult),
  };
}

/**
 * Returns the ONLY allowed member response body upon questionnaire submission.
 * Never includes verification status, beneficiary match, warnings, or internal IDs.
 */
export function sanitizePublicSubmissionResponse(submittedAt: Date) {
  return {
    ok: true,
    submittedAt: submittedAt.toISOString(),
    message:
      "تم استلام طلب المساعدة بنجاح. ستقوم إدارة الجمعية بمراجعة الطلب والتواصل معكم عند الحاجة.",
  };
}

/**
 * Strips any key that resembles a National ID before persisting security audit events.
 */
export function sanitizeAuditDetails(
  details?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (/national\s*id|nationalid|nid|idnumber/i.test(key)) {
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function requireAssistanceAdmin(options?: {
  resourceBranchId?: { toString(): string } | string | null;
}) {
  const [{ getAuthenticatedUser }, { getActorName }] = await Promise.all([
    import("@/lib/auth-helpers"),
    import("@/lib/notifications"),
  ]);

  const authResult = await getAuthenticatedUser();
  const resourceBranchStr = options?.resourceBranchId
    ? options.resourceBranchId.toString()
    : null;

  const decision = evaluateAssistanceAdminAccess(
    {
      userId: authResult.userId,
      role: authResult.role,
      branchId: authResult.branch ? authResult.branch.toString() : null,
      isSuperAdmin: authResult.isSuperAdmin,
      isAdmin: authResult.isAdmin,
      isMember: authResult.isMember,
    },
    { resourceBranchId: resourceBranchStr }
  );

  if (!decision.ok) {
    return {
      ok: false as const,
      status: decision.status,
      error: decision.error,
    };
  }

  return {
    ok: true as const,
    authResult,
    actorName: getActorName(authResult),
  };
}
