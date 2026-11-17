import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import AssistanceRequest from "@/lib/models/AssistanceRequest";
import { computeNationalIdBlindIndex } from "../crypto";
import {
  applyStatusTransition,
  buildAdminRequestsFilterQuery,
  checkDuplicateSubmissionWindow,
  computeStatusPriority,
  sortRequestsByWorkflowPriority,
} from "../workflow";

describe("Assistance Workflow, Ordering, Filters & Concurrency (Phase 10.4)", () => {
  before(() => {
    process.env.ASSISTANCE_NATIONAL_ID_SECRET =
      "test-only-national-id-master-secret-key-2026";
  });

  it("initializes new requests with status 'new' and priority 1", () => {
    const doc = new AssistanceRequest({
      fullName: "حسن محمد",
      nationalIdEncrypted: "v1:a:b:c",
      nationalIdBlindIndex: "abcd",
      nationalIdMasked: "**********0111",
      phone: "01012345678",
      address: "دمياط - الزرقا",
      assistanceCategory: "medical_aid",
      description: "أحتاج إلى مساعدة طبية لإجراء عملية جراحية",
      verificationStatus: "not_matched",
      relationshipType: "unknown",
    });

    assert.equal(doc.validateSync(), undefined);
    assert.equal(doc.status, "new");
    assert.equal(doc.statusPriority, 1);
    assert.equal(doc.version, 1);
  });

  it("orders requests strictly: new -> under_review -> reviewed -> completed/approved/rejected, newest first inside each group", () => {
    assert.equal(computeStatusPriority("new"), 1);
    assert.equal(computeStatusPriority("under_review"), 2);
    assert.equal(computeStatusPriority("reviewed"), 3);
    assert.equal(computeStatusPriority("approved"), 4);

    const sorted = sortRequestsByWorkflowPriority([
      { id: "approved_new", status: "approved" as const, createdAt: "2026-11-17T12:00:00Z" },
      { id: "new_older", status: "new" as const, createdAt: "2026-11-15T10:00:00Z" },
      { id: "reviewed_1", status: "reviewed" as const, createdAt: "2026-11-16T10:00:00Z" },
      { id: "under_1", status: "under_review" as const, createdAt: "2026-11-14T10:00:00Z" },
      { id: "new_newest", status: "new" as const, createdAt: "2026-11-17T09:00:00Z" },
    ]);

    assert.deepEqual(
      sorted.map((x) => x.id),
      ["new_newest", "new_older", "under_1", "reviewed_1", "approved_new"]
    );
  });

  it("records immutable status history entries and enforces optimistic concurrency", () => {
    const initialHistory = [
      {
        previousStatus: null,
        newStatus: "new" as const,
        changedBy: "public",
        changedByName: "تقديم إلكتروني",
        changedAt: new Date("2026-11-17T08:00:00Z"),
      },
    ];

    const step1 = applyStatusTransition(
      {
        status: "new",
        statusPriority: 1,
        version: 1,
        statusHistory: initialHistory,
      },
      {
        newStatus: "approved",
        actorId: "admin_1",
        actorName: "أحمد المسؤول",
        note: "تم فحص المستندات والموافقة",
        expectedVersion: 1,
      }
    );

    assert.equal(step1.ok, true);
    if (step1.ok) {
      assert.equal(step1.nextStatus, "approved");
      assert.equal(step1.nextStatusPriority, 4);
      assert.equal(step1.nextVersion, 2);
      assert.equal(step1.updatedHistory.length, 2);
      assert.equal(step1.updatedHistory[1].previousStatus, "new");
      assert.equal(step1.updatedHistory[1].newStatus, "approved");
      assert.equal(step1.updatedHistory[1].note, "تم فحص المستندات والموافقة");
    }

    // Stale expectedVersion must trigger 409 conflict
    const staleUpdate = applyStatusTransition(
      {
        status: "approved",
        statusPriority: 4,
        version: 2,
        statusHistory: initialHistory,
      },
      {
        newStatus: "completed",
        actorId: "admin_2",
        actorName: "مسؤول ثانٍ",
        expectedVersion: 1,
      }
    );
    assert.equal(staleUpdate.ok, false);
    if (!staleUpdate.ok) {
      assert.equal(staleUpdate.status, 409);
    }
  });

  it("builds admin filter queries including keyed blind-index National ID lookup", () => {
    const query = buildAdminRequestsFilterQuery(
      {
        searchName: "محمد",
        searchNationalId: "01234567890123",
        status: "new",
        verificationStatus: "matched_spouse",
        relationshipType: "beneficiary_spouse",
        dateFrom: "2026-11-01",
        dateTo: "2026-11-17",
      },
      { branch: "branch_1" }
    );

    const conditions = (query as { $and: Array<Record<string, unknown>> }).$and;
    assert.ok(Array.isArray(conditions));
    const expectedIndex = computeNationalIdBlindIndex("01234567890123");
    assert.ok(
      conditions.some((c) => c.nationalIdBlindIndex === expectedIndex)
    );
    assert.ok(conditions.some((c) => c.status === "new"));
    assert.ok(conditions.some((c) => c.verificationStatus === "matched_spouse"));
  });

  it("deduplicates identical re-submissions within 5 min while flagging legitimate new requests with open-request warning", () => {
    const now = new Date("2026-11-17T12:00:00Z");
    const twoMinutesAgo = new Date("2026-11-17T11:58:00Z");

    const samePayloadCheck = checkDuplicateSubmissionWindow(
      [
        {
          _id: "r1",
          assistanceCategory: "medical_aid",
          description: "أحتاج دعم شراء علاج شهري",
          status: "new",
          createdAt: twoMinutesAgo,
        },
      ],
      {
        assistanceCategory: "medical_aid",
        description: "أحتاج دعم شراء علاج شهري",
        now,
      }
    );
    assert.equal(samePayloadCheck.isIdempotentDuplicate, true);

    const legitimateSecondRequest = checkDuplicateSubmissionWindow(
      [
        {
          _id: "r1",
          assistanceCategory: "medical_aid",
          description: "أحتاج دعم شراء علاج شهري",
          status: "new",
          createdAt: twoMinutesAgo,
        },
      ],
      {
        assistanceCategory: "food_supply",
        description: "أحتاج كرتونة مواد غذائية للأسرة",
        now,
      }
    );
    assert.equal(legitimateSecondRequest.isIdempotentDuplicate, false);
    assert.equal(legitimateSecondRequest.hasOpenOtherRequest, true);
  });
});
