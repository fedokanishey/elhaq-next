import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyAssistanceHistory,
  type PrimaryBeneficiaryHistoryContext,
} from "../history";

const SAMPLE_PRIMARY: PrimaryBeneficiaryHistoryContext = {
  _id: "ben_primary_1",
  name: "محمود حسن إبراهيم",
  internalId: "45",
  nationalId: "27001011100111",
  receivesMonthlyAllowance: true,
  monthlyAllowanceAmount: 500,
};

describe("Previous Assistance History Separation (Phase 10.3)", () => {
  it("1. classifies primary beneficiary history including treasury shares, initiatives, self marriage & loans", () => {
    const report = classifyAssistanceHistory({
      relationshipType: "primary_beneficiary",
      applicantNationalId: "27001011100111",
      applicantBlindIndex: "blind_primary",
      currentRequestId: "req_current",
      primaryBeneficiary: SAMPLE_PRIMARY,
      treasuryExpenses: [
        {
          _id: "tx_1",
          amount: 1000,
          description: "صرف شهرية أكتوبر",
          category: "شهرية",
          transactionDate: "2026-10-01T00:00:00.000Z",
          beneficiaryIds: ["ben_primary_1", "ben_other"],
          beneficiaryShares: [
            { beneficiaryId: "ben_primary_1", amount: 500 },
            { beneficiaryId: "ben_other", amount: 500 },
          ],
          isMonthlyAllowance: true,
        },
      ],
      initiatives: [
        {
          _id: "init_1",
          name: "مبادرة كسوة الشتاء",
          date: "2026-01-15T00:00:00.000Z",
          status: "completed",
          beneficiariesReceived: ["ben_primary_1"],
        },
      ],
      loans: [
        {
          _id: "loan_1",
          beneficiaryName: "محمود حسن إبراهيم",
          nationalId: "27001011100111",
          amount: 3000,
          amountPaid: 1000,
          status: "active",
          startDate: "2026-05-01T00:00:00.000Z",
        },
      ],
    });

    assert.equal(report.mode, "primary");
    assert.equal(report.individualAssistance.length, 1);
    assert.equal(report.individualAssistance[0].source, "loan");
    assert.equal(report.familyAssistance.length, 2);
    assert.equal(report.summary.totalTreasuryShareAmount, 500);
    assert.equal(report.summary.receivesMonthlyAllowance, true);
  });

  it("2. strictly separates spouse personal assistance from family-level assistance", () => {
    const report = classifyAssistanceHistory({
      relationshipType: "beneficiary_spouse",
      applicantNationalId: "27502021100222",
      applicantBlindIndex: "blind_spouse",
      currentRequestId: "req_current",
      primaryBeneficiary: SAMPLE_PRIMARY,
      treasuryExpenses: [
        {
          _id: "tx_family",
          amount: 600,
          description: "إعانة علاج لملف الأسرة",
          transactionDate: "2026-09-01T00:00:00.000Z",
          beneficiaryIds: ["ben_primary_1"],
        },
      ],
      loans: [
        {
          _id: "loan_spouse",
          beneficiaryName: "أمينة محمد",
          nationalId: "27502021100222", // Spouse's own National ID
          amount: 2000,
          amountPaid: 2000,
          status: "completed",
          startDate: "2025-11-01T00:00:00.000Z",
        },
        {
          _id: "loan_husband",
          beneficiaryName: "محمود حسن",
          nationalId: "27001011100111", // Primary beneficiary's National ID
          amount: 4000,
          amountPaid: 1000,
          status: "active",
          startDate: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    assert.equal(report.mode, "family_member");
    assert.equal(report.individualAssistance.length, 1);
    assert.equal(report.individualAssistance[0].id, "loan_spouse");
    assert.equal(report.individualAssistance[0].scope, "individual");

    assert.equal(report.familyAssistance.length, 2);
    for (const fam of report.familyAssistance) {
      assert.equal(fam.scope, "family_level");
      assert.equal(fam.scopeLabel, "مساعدة على مستوى الأسرة");
    }
  });

  it("3. strictly separates specific child assistance from family-level & sibling assistance", () => {
    const report = classifyAssistanceHistory({
      relationshipType: "beneficiary_child",
      applicantNationalId: "30203031100333",
      applicantBlindIndex: "blind_child",
      currentRequestId: "req_current",
      primaryBeneficiary: SAMPLE_PRIMARY,
      treasuryExpenses: [
        {
          _id: "tx_house",
          amount: 500,
          description: "شهرية الأسرة",
          transactionDate: "2026-08-01T00:00:00.000Z",
          beneficiaryIds: ["ben_primary_1"],
        },
      ],
      initiatives: [
        {
          _id: "init_ramadan",
          name: "كرتونة رمضان",
          date: "2026-03-01T00:00:00.000Z",
          status: "completed",
          beneficiariesReceived: ["ben_primary_1"],
        },
      ],
      marriageCases: [
        {
          _id: "mc_this_child",
          beneficiary: "ben_primary_1",
          personName: "ندى محمود",
          relationship: "daughter",
          nationalId: "30203031100333", // Matches this exact child
          status: "completed",
          totalCost: 15000,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          _id: "mc_no_nid",
          beneficiary: "ben_primary_1",
          personName: "ندى محمود", // Same name, NO nationalId recorded -> must NOT be assumed personal!
          relationship: "daughter",
          status: "pending",
          totalCost: 0,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      priorRequests: [
        {
          _id: "req_sibling",
          assistanceCategory: "education_aid",
          status: "reviewed",
          createdAt: "2026-06-01T00:00:00.000Z",
          nationalIdBlindIndex: "blind_other_sibling",
          fullName: "أخ محمود",
          relationshipType: "beneficiary_child",
        },
      ],
    });

    assert.equal(report.mode, "family_member");
    assert.equal(report.individualAssistance.length, 1);
    assert.equal(report.individualAssistance[0].id, "mc_this_child");

    // mc_no_nid, tx_house, init_ramadan, and req_sibling are ALL strictly family_level
    assert.equal(report.familyAssistance.length, 4);
    assert.ok(report.familyAssistance.every((e) => e.scopeLabel === "مساعدة على مستوى الأسرة"));
    assert.ok(report.limitationsNotice.length >= 2);
  });
});
