import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeNationalIdBlindIndex,
  decryptNationalId,
  encryptNationalId,
  maskNationalId,
} from "../crypto";
import {
  evaluateAssistanceAdminAccess,
  evaluateAssistanceReadAccess,
  evaluateAssistanceSubmitAccess,
  sanitizeAuditDetails,
  sanitizePublicSubmissionResponse,
} from "../auth";
import { validateAssistanceSubmission, ValidationError } from "../validation";
import AssistanceAuditLog from "@/lib/models/AssistanceAuditLog";

describe("Privacy, Cryptography & Access Control (Phase 10.2)", () => {
  before(() => {
    process.env.ASSISTANCE_NATIONAL_ID_SECRET =
      "test-only-national-id-master-secret-key-2026";
  });

  it("encrypts and decrypts National IDs via AES-256-GCM while preserving leading zeros", () => {
    const leadingZeroId = "00123456789012";
    const encrypted = encryptNationalId(leadingZeroId);

    assert.ok(encrypted.startsWith("v1:"));
    assert.equal(encrypted.includes(leadingZeroId), false);
    assert.equal(decryptNationalId(encrypted), leadingZeroId);

    // Different random IV per encryption
    const encryptedAgain = encryptNationalId(leadingZeroId);
    assert.notEqual(encrypted, encryptedAgain);

    // Tampered auth tag / ciphertext must fail authentication
    const parts = encrypted.split(":");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    assert.throws(() => decryptNationalId(parts.join(":")));
  });

  it("computes deterministic keyed HMAC blind index distinguishing leading zeros", () => {
    const idxLeadingZero = computeNationalIdBlindIndex("01234567890123");
    const idxRepeat = computeNationalIdBlindIndex("01234567890123");
    const idxWithoutZero = computeNationalIdBlindIndex("1234567890123");

    assert.equal(idxLeadingZero, idxRepeat);
    assert.notEqual(idxLeadingZero, idxWithoutZero);
    assert.equal(idxLeadingZero.length, 64);
    assert.equal(idxLeadingZero.includes("01234567890123"), false);
  });

  it("masks National IDs safely by default", () => {
    assert.equal(maskNationalId("01234567890123"), "**********0123");
    assert.equal(maskNationalId(null), "—");
    assert.equal(maskNationalId("123"), "***");
  });

  it("member submission response reveals zero verification status or match details", () => {
    const now = new Date("2026-11-17T10:00:00.000Z");
    const pubRes = sanitizePublicSubmissionResponse(now);

    assert.deepEqual(Object.keys(pubRes).sort(), ["message", "ok", "submittedAt"]);
    assert.equal(pubRes.ok, true);
    assert.equal(pubRes.submittedAt, "2026-11-17T10:00:00.000Z");

    const serialized = JSON.stringify(pubRes);
    assert.equal(serialized.includes("matched"), false);
    assert.equal(serialized.includes("beneficiary"), false);
    assert.equal(serialized.includes("adminNotes"), false);
    assert.equal(serialized.includes("warnings"), false);
  });

  it("enforces strict server-side authorization and prevents member & cross-branch IDOR access", () => {
    // 1. Unauthenticated caller -> 401
    const unauth = evaluateAssistanceAdminAccess({
      userId: null,
      role: "user",
      branchId: null,
      isSuperAdmin: false,
      isAdmin: false,
      isMember: false,
    });
    assert.equal(unauth.ok, false);
    if (!unauth.ok) assert.equal(unauth.status, 401);

    // 2. Regular user -> 403
    const normalUser = evaluateAssistanceAdminAccess({
      userId: "user_1",
      role: "user",
      branchId: "branch_1",
      isSuperAdmin: false,
      isAdmin: false,
      isMember: false,
    });
    assert.equal(normalUser.ok, false);
    if (!normalUser.ok) assert.equal(normalUser.status, 403);

    // 3. Committee Member (`member` role) -> strictly 403 (no admin dashboard, notes, or reveal)
    const member = evaluateAssistanceAdminAccess({
      userId: "member_1",
      role: "member",
      branchId: "branch_1",
      isSuperAdmin: false,
      isAdmin: false,
      isMember: true,
    });
    assert.equal(member.ok, false);
    if (!member.ok) assert.equal(member.status, 403);

    // 4. Branch Admin accessing OTHER branch's request -> 403 IDOR prevention
    const crossBranchAdmin = evaluateAssistanceAdminAccess(
      {
        userId: "admin_1",
        role: "admin",
        branchId: "branch_1",
        isSuperAdmin: false,
        isAdmin: true,
        isMember: false,
      },
      { resourceBranchId: "branch_2" }
    );
    assert.equal(crossBranchAdmin.ok, false);
    if (!crossBranchAdmin.ok) assert.equal(crossBranchAdmin.status, 403);

    // 5. Branch Admin accessing OWN branch's request -> allowed
    const ownBranchAdmin = evaluateAssistanceAdminAccess(
      {
        userId: "admin_1",
        role: "admin",
        branchId: "branch_1",
        isSuperAdmin: false,
        isAdmin: true,
        isMember: false,
      },
      { resourceBranchId: "branch_1" }
    );
    assert.equal(ownBranchAdmin.ok, true);

    // 6. SuperAdmin accessing any branch -> allowed
    const superAdmin = evaluateAssistanceAdminAccess(
      {
        userId: "super_1",
        role: "superadmin",
        branchId: null,
        isSuperAdmin: true,
        isAdmin: false,
        isMember: false,
      },
      { resourceBranchId: "branch_2" }
    );
    assert.equal(superAdmin.ok, true);
  });

  it("never stores plaintext National IDs in audit event details", () => {
    const cleaned = sanitizeAuditDetails({
      target: "applicant",
      nationalId: "29001161100744",
      nested: {
        applicantNationalId: "29001161100744",
        safeFlag: true,
      },
    });

    assert.deepEqual(cleaned, {
      target: "applicant",
      nested: { safeFlag: true },
    });

    const auditDoc = new AssistanceAuditLog({
      requestId: "65f000000000000000009999",
      action: "national_id_revealed",
      actorId: "admin_1",
      actorName: "مسؤول الفرع",
      details: sanitizeAuditDetails({ target: "applicant", nationalId: "29001161100744" }),
    });
    assert.equal(auditDoc.validateSync(), undefined);
    assert.equal(JSON.stringify(auditDoc.details).includes("29001161100744"), false);
  });

  it("rejects untrusted or non-HTTPS attachment URLs", () => {
    assert.throws(
      () =>
        validateAssistanceSubmission({
          fullName: "أحمد حسن علي",
          nationalId: "29001161100744",
          phone: "01012345678",
          address: "دمياط الزرقا شارع 5",
          assistanceCategory: "medical_aid",
          description: "أحتاج إلى دعم تكاليف الدواء الشهري",
          attachments: ["https://evil.example.com/payload.png"],
        }),
      ValidationError
    );

    const okSubmission = validateAssistanceSubmission({
      fullName: "أحمد حسن علي",
      nationalId: "29001161100744",
      phone: "01012345678",
      address: "دمياط الزرقا شارع 5",
      assistanceCategory: "medical_aid",
      description: "أحتاج إلى دعم تكاليف الدواء الشهري",
      attachments: ["https://res.cloudinary.com/demo/image/upload/doc.jpg"],
    });
    assert.equal(okSubmission.attachments.length, 1);
  });

  it("allows any authenticated user to submit the assistance questionnaire while denying guests", () => {
    const guest = evaluateAssistanceSubmitAccess({
      userId: null,
      role: "user",
      branchId: null,
      isSuperAdmin: false,
      isAdmin: false,
      isMember: false,
    });
    assert.equal(guest.ok, false);
    if (!guest.ok) assert.equal(guest.status, 401);

    const basicUser = evaluateAssistanceSubmitAccess({
      userId: "user_1",
      role: "user",
      branchId: "branch_1",
      isSuperAdmin: false,
      isAdmin: false,
      isMember: false,
    });
    assert.equal(basicUser.ok, true);

    const memberUser = evaluateAssistanceSubmitAccess({
      userId: "member_1",
      role: "member",
      branchId: "branch_1",
      isSuperAdmin: false,
      isAdmin: false,
      isMember: true,
    });
    assert.equal(memberUser.ok, true);

    const adminUser = evaluateAssistanceSubmitAccess({
      userId: "admin_1",
      role: "admin",
      branchId: "branch_1",
      isSuperAdmin: false,
      isAdmin: true,
      isMember: false,
    });
    assert.equal(adminUser.ok, true);

    const superAdminUser = evaluateAssistanceSubmitAccess({
      userId: "super_1",
      role: "superadmin",
      branchId: null,
      isSuperAdmin: true,
      isAdmin: false,
      isMember: false,
    });
    assert.equal(superAdminUser.ok, true);
  });

  it("grants read-only assistance request viewing to same-branch `member` while blocking regular `user` and cross-branch `member`", () => {
    const guest = evaluateAssistanceReadAccess({
      userId: null,
      role: "user",
      branchId: null,
      isSuperAdmin: false,
      isAdmin: false,
      isMember: false,
    });
    assert.equal(guest.ok, false);
    if (!guest.ok) assert.equal(guest.status, 401);

    const regularUser = evaluateAssistanceReadAccess({
      userId: "user_1",
      role: "user",
      branchId: "branch_1",
      isSuperAdmin: false,
      isAdmin: false,
      isMember: false,
    });
    assert.equal(regularUser.ok, false);
    if (!regularUser.ok) assert.equal(regularUser.status, 403);

    const ownBranchMember = evaluateAssistanceReadAccess(
      {
        userId: "member_1",
        role: "member",
        branchId: "branch_1",
        isSuperAdmin: false,
        isAdmin: false,
        isMember: true,
      },
      { resourceBranchId: "branch_1" }
    );
    assert.equal(ownBranchMember.ok, true);

    const crossBranchMember = evaluateAssistanceReadAccess(
      {
        userId: "member_1",
        role: "member",
        branchId: "branch_1",
        isSuperAdmin: false,
        isAdmin: false,
        isMember: true,
      },
      { resourceBranchId: "branch_2" }
    );
    assert.equal(crossBranchMember.ok, false);
    if (!crossBranchMember.ok) assert.equal(crossBranchMember.status, 403);

    const unassignedMember = evaluateAssistanceReadAccess(
      {
        userId: "member_2",
        role: "member",
        branchId: null,
        isSuperAdmin: false,
        isAdmin: false,
        isMember: true,
      },
      { resourceBranchId: "branch_1" }
    );
    assert.equal(unassignedMember.ok, false);
    if (!unassignedMember.ok) assert.equal(unassignedMember.status, 403);

    const ownBranchAdmin = evaluateAssistanceReadAccess(
      {
        userId: "admin_1",
        role: "admin",
        branchId: "branch_1",
        isSuperAdmin: false,
        isAdmin: true,
        isMember: false,
      },
      { resourceBranchId: "branch_1" }
    );
    assert.equal(ownBranchAdmin.ok, true);

    const crossBranchAdmin = evaluateAssistanceReadAccess(
      {
        userId: "admin_1",
        role: "admin",
        branchId: "branch_1",
        isSuperAdmin: false,
        isAdmin: true,
        isMember: false,
      },
      { resourceBranchId: "branch_2" }
    );
    assert.equal(crossBranchAdmin.ok, false);
    if (!crossBranchAdmin.ok) assert.equal(crossBranchAdmin.status, 403);

    const superAdmin = evaluateAssistanceReadAccess(
      {
        userId: "super_1",
        role: "superadmin",
        branchId: null,
        isSuperAdmin: true,
        isAdmin: false,
        isMember: false,
      },
      { resourceBranchId: "branch_2" }
    );
    assert.equal(superAdmin.ok, true);
  });
});
