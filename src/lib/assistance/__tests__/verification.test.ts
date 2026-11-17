import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateVerificationCandidates,
  normalizeExactNationalId,
  verifyApplicantAgainstDatabase,
  type LeanBeneficiaryForVerification,
} from "../verification";
import { validateAssistanceSubmission, ValidationError } from "../validation";

function makeBaseBeneficiary(
  overrides: Partial<LeanBeneficiaryForVerification> = {}
): LeanBeneficiaryForVerification {
  return {
    _id: "65f000000000000000000001",
    name: "أحمد محمود علي",
    internalId: "101",
    nationalId: "28001011100111",
    maritalStatus: "married",
    status: "active",
    branch: "65f00000000000000000b001",
    branchName: "الزرقا",
    spouse: undefined,
    children: [],
    relationships: [],
    ...overrides,
  };
}

describe("Beneficiary Verification Engine (Phase 10.1)", () => {
  it("1. matches primary beneficiary exact National ID", () => {
    const ben = makeBaseBeneficiary();
    const res = evaluateVerificationCandidates("28001011100111", [ben]);

    assert.equal(res.verificationStatus, "matched_primary_beneficiary");
    assert.equal(res.relationshipType, "primary_beneficiary");
    assert.equal(res.beneficiaryId, "65f000000000000000000001");
    assert.equal(res.beneficiarySnapshot?.name, "أحمد محمود علي");
    assert.equal(res.matchedPerson?.personType, "primary");
    assert.deepEqual(res.warnings, []);
  });

  it("2a. matches spouse (wife of male primary beneficiary) and links to primary beneficiary", () => {
    const ben = makeBaseBeneficiary({
      name: "إبراهيم محمد ضيف",
      nationalId: "26508011100378",
      spouse: {
        name: "شادية محمد حلمي",
        nationalId: "27005051100222",
        phone: "01011112222",
      },
    });

    const res = evaluateVerificationCandidates("27005051100222", [ben]);

    assert.equal(res.verificationStatus, "matched_spouse");
    assert.equal(res.relationshipType, "beneficiary_spouse");
    assert.equal(res.beneficiaryId, "65f000000000000000000001");
    assert.equal(res.beneficiarySnapshot?.name, "إبراهيم محمد ضيف");
    assert.equal(res.matchedPerson?.name, "شادية محمد حلمي");
    assert.equal(res.matchedPerson?.personType, "spouse");
    assert.deepEqual(res.warnings, []);
  });

  it("2b. matches spouse (husband of female primary beneficiary) without gender inference", () => {
    const ben = makeBaseBeneficiary({
      name: "فاطمة السيد حسن",
      nationalId: "28503031100999",
      spouse: {
        name: "خالد عبد الرحمن",
        nationalId: "28102021100888",
      },
    });

    const res = evaluateVerificationCandidates("28102021100888", [ben]);

    assert.equal(res.verificationStatus, "matched_spouse");
    assert.equal(res.relationshipType, "beneficiary_spouse");
    assert.equal(res.beneficiarySnapshot?.name, "فاطمة السيد حسن");
    assert.equal(res.matchedPerson?.name, "خالد عبد الرحمن");
    assert.equal(res.matchedPerson?.personType, "spouse");
  });

  it("3. matches exact child among multiple children (modern `nationalId` and legacy `idNumber`)", () => {
    const ben = makeBaseBeneficiary({
      children: [
        {
          _id: "c1",
          name: "يوسف أحمد",
          gender: "male",
          nationalId: "30501011100111",
        },
        {
          _id: "c2",
          name: "مريم أحمد",
          gender: "female",
          idNumber: "30702021100222", // Legacy field from BeneficiaryDetailsView/utils
        },
        {
          _id: "c3",
          name: "عمر أحمد",
          gender: "male",
          nationalId: "31003031100333",
        },
      ],
    });

    const resModern = evaluateVerificationCandidates("31003031100333", [ben]);
    assert.equal(resModern.verificationStatus, "matched_child");
    assert.equal(resModern.relationshipType, "beneficiary_child");
    assert.equal(resModern.beneficiaryId, "65f000000000000000000001");
    assert.equal(resModern.matchedPerson?.name, "عمر أحمد");
    assert.equal(resModern.matchedPerson?.subId, "c3");
    assert.equal(resModern.matchedPerson?.gender, "male");

    const resLegacy = evaluateVerificationCandidates("30702021100222", [ben]);
    assert.equal(resLegacy.verificationStatus, "matched_child");
    assert.equal(resLegacy.relationshipType, "beneficiary_child");
    assert.equal(resLegacy.matchedPerson?.name, "مريم أحمد");
    assert.equal(resLegacy.matchedPerson?.specificRelation, "daughter");
  });

  it("3b. matches married child's spouse and explicit relationships[] without intra-record false conflicts", () => {
    const ben = makeBaseBeneficiary({
      spouse: { name: "هند علي", nationalId: "28204041100444" },
      children: [
        {
          _id: "c1",
          name: "أحمد الابن",
          maritalStatus: "married",
          nationalId: "30001011100555",
          spouse: {
            name: "دعاء سالم",
            nationalId: "30106061100666",
          },
        },
      ],
      relationships: [
        {
          relation: "spouse",
          relativeName: "هند علي",
          relativeNationalId: "28204041100444",
        },
        {
          relation: "mother",
          relativeName: "سعاد كامل",
          relativeNationalId: "25501011100777",
        },
      ],
    });

    // Redundant spouse entry in both spouse & relationships[] deduplicates cleanly
    const resSpouse = evaluateVerificationCandidates("28204041100444", [ben]);
    assert.equal(resSpouse.verificationStatus, "matched_spouse");
    assert.equal(resSpouse.relationshipType, "beneficiary_spouse");

    // Child's spouse
    const resChildSpouse = evaluateVerificationCandidates("30106061100666", [ben]);
    assert.equal(resChildSpouse.verificationStatus, "matched_other_dependent");
    assert.equal(resChildSpouse.relationshipType, "other_dependent");
    assert.equal(resChildSpouse.matchedPerson?.personType, "child_spouse");
    assert.equal(resChildSpouse.matchedPerson?.relatedViaName, "أحمد الابن");

    // Parent/relative in relationships[]
    const resMother = evaluateVerificationCandidates("25501011100777", [ben]);
    assert.equal(resMother.verificationStatus, "matched_other_dependent");
    assert.equal(resMother.relationshipType, "other_dependent");
    assert.equal(resMother.matchedPerson?.name, "سعاد كامل");
    assert.equal(resMother.matchedPerson?.specificRelation, "mother");
  });

  it("4. returns not_matched + unknown when applicant National ID does not match any field", () => {
    const ben = makeBaseBeneficiary({
      spouse: { name: "سلمى", nationalId: "28111111111111" },
      children: [{ name: "باسم", nationalId: "30555555555555" }],
    });

    const res = evaluateVerificationCandidates("29999999999999", [ben]);
    assert.equal(res.verificationStatus, "not_matched");
    assert.equal(res.relationshipType, "unknown");
    assert.equal(res.beneficiaryId, null);
    assert.equal(res.matchedPerson, null);
    assert.deepEqual(res.warnings, []);
  });

  it("5. flags duplicate National ID across multiple beneficiary records for manual_review", () => {
    const benA = makeBaseBeneficiary({
      _id: "65f000000000000000000010",
      name: "أسرة 1",
      children: [{ name: "كريم", nationalId: "30404041100444" }],
    });
    const benB = makeBaseBeneficiary({
      _id: "65f000000000000000000020",
      name: "أسرة 2",
      children: [{ name: "كريم", nationalId: "30404041100444" }],
    });

    const res = evaluateVerificationCandidates("30404041100444", [benA, benB]);
    assert.equal(res.verificationStatus, "manual_review");
    assert.equal(res.beneficiaryId, null);
    assert.equal(res.candidateMatches.length, 2);
    assert.ok(res.warnings.includes("duplicate_national_id"));
    assert.ok(res.warnings.includes("multiple_possible_matches"));
  });

  it("6. flags conflicting relationship types (e.g., primary in one record and child in another)", () => {
    const benA = makeBaseBeneficiary({
      _id: "65f000000000000000000031",
      name: "الأب سالم",
      nationalId: "26001011100001",
      children: [{ name: "طارق سالم", nationalId: "29505051100555" }],
    });
    const benB = makeBaseBeneficiary({
      _id: "65f000000000000000000032",
      name: "طارق سالم",
      nationalId: "29505051100555",
    });

    const res = evaluateVerificationCandidates("29505051100555", [benA, benB]);
    assert.equal(res.verificationStatus, "manual_review");
    assert.equal(res.relationshipType, "unknown");
    assert.equal(res.beneficiaryId, null);
    assert.ok(res.warnings.includes("conflicting_relationship_types"));
    assert.ok(res.warnings.includes("multiple_possible_matches"));
  });

  it("7. handles missing spouse name with incomplete_matched_person_data manual_review", () => {
    const ben = makeBaseBeneficiary({
      spouse: { nationalId: "28404041100123" }, // Missing name
    });

    const res = evaluateVerificationCandidates("28404041100123", [ben]);
    assert.equal(res.verificationStatus, "manual_review");
    assert.ok(res.warnings.includes("incomplete_matched_person_data"));

    const benNoSpouse = makeBaseBeneficiary({ spouse: undefined });
    const resNoSpouse = evaluateVerificationCandidates("28404041100123", [
      benNoSpouse,
    ]);
    assert.equal(resNoSpouse.verificationStatus, "not_matched");
  });

  it("8. handles invalid/missing primary beneficiary reference when a child matches", () => {
    const brokenBen = makeBaseBeneficiary({
      _id: "",
      name: "",
      children: [{ name: "طفل", nationalId: "31201011100111" }],
    });

    const res = evaluateVerificationCandidates("31201011100111", [brokenBen]);
    assert.equal(res.verificationStatus, "manual_review");
    assert.equal(res.relationshipType, "unknown");
    assert.equal(res.beneficiaryId, null);
    assert.ok(res.warnings.includes("invalid_primary_beneficiary"));
  });

  it("9. detects inconsistent family relationships (divorced beneficiary with spouse NID / conflicting child IDs)", () => {
    const inconsistentSpouseBen = makeBaseBeneficiary({
      maritalStatus: "divorced",
      spouse: { name: "هدى", nationalId: "28606061100666" },
    });
    const resSpouse = evaluateVerificationCandidates("28606061100666", [
      inconsistentSpouseBen,
    ]);
    assert.equal(resSpouse.verificationStatus, "manual_review");
    assert.ok(resSpouse.warnings.includes("inconsistent_family_relationship"));

    const inconsistentChildBen = makeBaseBeneficiary({
      children: [
        {
          name: "حسام",
          nationalId: "30808081100888",
          idNumber: "30808081100999",
        },
      ],
    });
    const resChild = evaluateVerificationCandidates("30808081100888", [
      inconsistentChildBen,
    ]);
    assert.equal(resChild.verificationStatus, "manual_review");
    assert.ok(resChild.warnings.includes("inconsistent_family_relationship"));
  });

  it("10. flags cancelled/inactive beneficiaries for manual_review", () => {
    const cancelledBen = makeBaseBeneficiary({
      status: "cancelled",
      nationalId: "27707071100777",
    });

    const res = evaluateVerificationCandidates("27707071100777", [cancelledBen]);
    assert.equal(res.verificationStatus, "manual_review");
    assert.ok(res.warnings.includes("beneficiary_inactive"));
  });

  it("11. degrades safely to manual_review when beneficiary database source is unavailable", async () => {
    const res = await verifyApplicantAgainstDatabase(
      "29001161100744",
      async () => {
        throw new Error("MongoServerSelectionError: connection timed out");
      }
    );

    assert.equal(res.verificationStatus, "manual_review");
    assert.equal(res.relationshipType, "unknown");
    assert.equal(res.beneficiaryId, null);
    assert.deepEqual(res.warnings, ["verification_source_unavailable"]);
  });

  it("12. preserves leading zeros in string National IDs and never strips them", () => {
    const leadingZeroBen = makeBaseBeneficiary({
      name: "سعيد ذو الصفر البادئ",
      nationalId: "01234567890123",
    });

    const exactHit = evaluateVerificationCandidates("01234567890123", [
      leadingZeroBen,
    ]);
    assert.equal(exactHit.verificationStatus, "matched_primary_beneficiary");

    const strippedMiss = evaluateVerificationCandidates("1234567890123", [
      leadingZeroBen,
    ]);
    assert.equal(strippedMiss.verificationStatus, "not_matched");

    // Numeric runtime input rejected by normalizer & validator
    assert.equal(normalizeExactNationalId(1234567890123 as unknown as string), null);
    assert.throws(
      () =>
        validateAssistanceSubmission({
          fullName: "محمد علي",
          nationalId: 12345678901234,
          phone: "01012345678",
          address: "دمياط الزرقا شارع 10",
          assistanceCategory: "financial_aid",
          description: "أرجو دراسة طلبي للمساعدة المالية",
        }),
      ValidationError
    );
  });

  it("13. compares National IDs strictly and never matches fuzzily by name or partial digits", () => {
    const ben = makeBaseBeneficiary({
      name: "غادة طاهر رضا",
      nationalId: "29001161100744",
    });

    // Off by 1 last digit -> strictly not_matched
    const nearMiss = evaluateVerificationCandidates("29001161100745", [ben]);
    assert.equal(nearMiss.verificationStatus, "not_matched");
    assert.equal(nearMiss.beneficiaryId, null);
  });
});
