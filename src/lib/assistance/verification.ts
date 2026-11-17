import type {
  ApplicantRelationshipType,
  BeneficiarySnapshot,
  CandidateMatchSummary,
  MatchedPersonInfo,
  VerificationEvaluation,
  VerificationWarningCode,
} from "./types";

export interface LeanBeneficiaryChild {
  _id?: unknown;
  name?: string;
  gender?: "male" | "female" | string;
  nationalId?: string;
  idNumber?: string;
  maritalStatus?: string;
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
  };
}

export interface LeanBeneficiaryRelationship {
  relation?: string;
  relativeName?: string;
  relativeNationalId?: string;
}

export interface LeanBeneficiaryForVerification {
  _id?: unknown;
  name?: string;
  internalId?: string;
  nationalId?: string;
  maritalStatus?: string;
  status?: "active" | "cancelled" | "pending" | string;
  branch?: unknown;
  branchName?: string;
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
  };
  children?: LeanBeneficiaryChild[];
  relationships?: LeanBeneficiaryRelationship[];
}

/**
 * Accepts only string National IDs containing ASCII digits and preserves leading zeros.
 * Numeric inputs are rejected because Number conversion irreversibly destroys leading zeros.
 */
export function normalizeExactNationalId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  return trimmed;
}

function stringifyId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && "toString" in val && typeof val.toString === "function") {
    const str = val.toString();
    return str !== "[object Object]" ? str : "";
  }
  return "";
}

function addWarning(list: VerificationWarningCode[], code: VerificationWarningCode) {
  if (!list.includes(code)) {
    list.push(code);
  }
}

function mapRelationshipEnum(relation?: string): {
  verificationType: "matched_spouse" | "matched_child" | "matched_other_dependent";
  relationshipType: "beneficiary_spouse" | "beneficiary_child" | "other_dependent";
} {
  if (relation === "spouse") {
    return {
      verificationType: "matched_spouse",
      relationshipType: "beneficiary_spouse",
    };
  }
  if (relation === "son" || relation === "daughter") {
    return {
      verificationType: "matched_child",
      relationshipType: "beneficiary_child",
    };
  }
  return {
    verificationType: "matched_other_dependent",
    relationshipType: "other_dependent",
  };
}

function normalizeChildGenderSafe(gender?: string): {
  specificRelation: "son" | "daughter" | "child";
  cleanGender?: "male" | "female";
} {
  if (gender === "male") return { specificRelation: "son", cleanGender: "male" };
  if (gender === "female") return { specificRelation: "daughter", cleanGender: "female" };
  return { specificRelation: "child" };
}

/**
 * Pure verification engine inspecting all 5 National ID locations collected by
 * the Elhaq Next beneficiary registration form:
 * 1. beneficiary.nationalId (Primary beneficiary)
 * 2. beneficiary.spouse.nationalId (Spouse - husband or wife)
 * 3. beneficiary.children[i].nationalId & legacy idNumber (Children)
 * 4. beneficiary.children[i].spouse.nationalId (Married child's spouse)
 * 5. beneficiary.relationships[i].relativeNationalId (Explicit family relationships)
 */
export function evaluateVerificationCandidates(
  applicantNationalIdRaw: string,
  records: LeanBeneficiaryForVerification[]
): VerificationEvaluation {
  const applicantNationalId = normalizeExactNationalId(applicantNationalIdRaw);
  if (!applicantNationalId) {
    return {
      verificationStatus: "manual_review",
      relationshipType: "unknown",
      beneficiaryId: null,
      beneficiarySnapshot: null,
      matchedPerson: null,
      warnings: ["incomplete_matched_person_data"],
      candidateMatches: [],
    };
  }

  const candidates: CandidateMatchSummary[] = [];

  for (const record of records || []) {
    const beneficiaryId = stringifyId(record._id);
    const beneficiaryName = (record.name || "").trim();
    const recordBaseWarnings: VerificationWarningCode[] = [];

    if (!beneficiaryId || !beneficiaryName) {
      addWarning(recordBaseWarnings, "invalid_primary_beneficiary");
    }
    if (record.status === "cancelled") {
      addWarning(recordBaseWarnings, "beneficiary_inactive");
    } else if (record.status === "pending") {
      addWarning(recordBaseWarnings, "beneficiary_pending");
    }

    const pushCandidate = (
      verificationType: CandidateMatchSummary["verificationType"],
      relationshipType: CandidateMatchSummary["relationshipType"],
      matchedPerson: MatchedPersonInfo,
      localWarnings: VerificationWarningCode[]
    ) => {
      const mergedWarnings = [...recordBaseWarnings];
      for (const w of localWarnings) {
        addWarning(mergedWarnings, w);
      }

      candidates.push({
        beneficiaryId,
        beneficiaryName: beneficiaryName || "مستفيد بدون اسم مسجل",
        beneficiaryInternalId: record.internalId?.trim() || undefined,
        beneficiaryStatus: record.status || undefined,
        branchName: record.branchName?.trim() || undefined,
        verificationType,
        relationshipType,
        matchedPerson,
        warnings: mergedWarnings,
      });
    };

    // 1. Primary beneficiary National ID
    const primaryNatId = normalizeExactNationalId(record.nationalId);
    let matchedPrimaryInRecord = false;
    if (primaryNatId === applicantNationalId) {
      matchedPrimaryInRecord = true;
      pushCandidate(
        "matched_primary_beneficiary",
        "primary_beneficiary",
        {
          name: beneficiaryName || undefined,
          personType: "primary",
          specificRelation: "primary_beneficiary",
        },
        []
      );
    }

    // 2. Spouse National ID
    const spouseNatId = normalizeExactNationalId(record.spouse?.nationalId);
    let matchedSpouseInRecord = false;
    let matchedSpouseName = "";
    if (spouseNatId === applicantNationalId) {
      matchedSpouseInRecord = true;
      matchedSpouseName = (record.spouse?.name || "").trim();
      const warnings: VerificationWarningCode[] = [];
      if (!matchedSpouseName) {
        addWarning(warnings, "incomplete_matched_person_data");
      }
      if (record.maritalStatus && record.maritalStatus !== "married") {
        addWarning(warnings, "inconsistent_family_relationship");
      }

      pushCandidate(
        "matched_spouse",
        "beneficiary_spouse",
        {
          name: matchedSpouseName || undefined,
          personType: "spouse",
          specificRelation: "spouse",
        },
        warnings
      );
    }

    // 3. Children (both `nationalId` and legacy `idNumber`) & 4. Married child's spouse
    const matchedChildrenNamesInRecord: string[] = [];
    if (Array.isArray(record.children)) {
      for (let i = 0; i < record.children.length; i += 1) {
        const child = record.children[i];
        if (!child) continue;

        const childNatId = normalizeExactNationalId(child.nationalId);
        const childLegacyId = normalizeExactNationalId(child.idNumber);
        const childMatches =
          childNatId === applicantNationalId || childLegacyId === applicantNationalId;

        if (childMatches) {
          const childName = (child.name || "").trim();
          if (childName) {
            matchedChildrenNamesInRecord.push(childName);
          }

          const warnings: VerificationWarningCode[] = [];
          if (!childName) {
            addWarning(warnings, "incomplete_matched_person_data");
          }
          if (childNatId && childLegacyId && childNatId !== childLegacyId) {
            addWarning(warnings, "inconsistent_family_relationship");
          }

          const { specificRelation, cleanGender } = normalizeChildGenderSafe(child.gender);

          pushCandidate(
            "matched_child",
            "beneficiary_child",
            {
              name: childName || undefined,
              personType: "child",
              subId: stringifyId(child._id) || String(i),
              specificRelation,
              gender: cleanGender,
            },
            warnings
          );
        }

        // 4. Married child's spouse
        const childSpouseNatId = normalizeExactNationalId(child.spouse?.nationalId);
        if (childSpouseNatId === applicantNationalId) {
          const spouseName = (child.spouse?.name || "").trim();
          const childName = (child.name || "").trim();
          const warnings: VerificationWarningCode[] = [];
          if (!spouseName) {
            addWarning(warnings, "incomplete_matched_person_data");
          }
          if (child.maritalStatus && child.maritalStatus !== "married") {
            addWarning(warnings, "inconsistent_family_relationship");
          }

          pushCandidate(
            "matched_other_dependent",
            "other_dependent",
            {
              name: spouseName || undefined,
              personType: "child_spouse",
              subId: stringifyId(child._id) || String(i),
              specificRelation: "child_spouse",
              relatedViaName: childName || undefined,
            },
            warnings
          );
        }
      }
    }

    // 5. Explicit family relationships (`beneficiary.relationships[]`)
    if (Array.isArray(record.relationships)) {
      for (let i = 0; i < record.relationships.length; i += 1) {
        const rel = record.relationships[i];
        if (!rel) continue;

        const relNatId = normalizeExactNationalId(rel.relativeNationalId);
        if (relNatId !== applicantNationalId) continue;

        const relName = (rel.relativeName || "").trim();
        const mapped = mapRelationshipEnum(rel.relation);

        // Deduplicate intra-record redundant entry when spouse/child was entered in both places identically
        const isRedundantSpouse =
          matchedSpouseInRecord &&
          mapped.relationshipType === "beneficiary_spouse" &&
          (!relName || !matchedSpouseName || relName === matchedSpouseName);

        const isRedundantChild =
          mapped.relationshipType === "beneficiary_child" &&
          matchedChildrenNamesInRecord.length > 0 &&
          relName &&
          matchedChildrenNamesInRecord.includes(relName);

        // Also guard against self-reference duplicate if somehow entered cleanly? No — primary in relationships is a conflict!
        if (isRedundantSpouse || isRedundantChild) {
          continue;
        }

        const warnings: VerificationWarningCode[] = [];
        if (!relName) {
          addWarning(warnings, "incomplete_matched_person_data");
        }
        if (matchedPrimaryInRecord) {
          addWarning(warnings, "conflicting_relationship_types");
        }

        pushCandidate(
          mapped.verificationType,
          mapped.relationshipType,
          {
            name: relName || undefined,
            personType: "relative",
            subId: String(i),
            specificRelation: rel.relation || "other",
            gender:
              rel.relation === "son"
                ? "male"
                : rel.relation === "daughter"
                ? "female"
                : undefined,
          },
          warnings
        );
      }
    }
  }

  // Case D: No match
  if (candidates.length === 0) {
    return {
      verificationStatus: "not_matched",
      relationshipType: "unknown",
      beneficiaryId: null,
      beneficiarySnapshot: null,
      matchedPerson: null,
      warnings: [],
      candidateMatches: [],
    };
  }

  // Single candidate evaluation
  if (candidates.length === 1) {
    const candidate = candidates[0];
    const hasInvalidParent = candidate.warnings.includes("invalid_primary_beneficiary");
    const blockingWarnings = candidate.warnings.filter((w) => w !== "beneficiary_pending");

    const sourceRecord = records.find((r) => stringifyId(r._id) === candidate.beneficiaryId);
    const snapshot: BeneficiarySnapshot | null = hasInvalidParent
      ? null
      : {
          name: candidate.beneficiaryName,
          internalId: candidate.beneficiaryInternalId,
          status: candidate.beneficiaryStatus,
          branchId: stringifyId(sourceRecord?.branch) || undefined,
          branchName: candidate.branchName,
        };

    if (blockingWarnings.length > 0) {
      return {
        verificationStatus: "manual_review",
        relationshipType: hasInvalidParent ? "unknown" : candidate.relationshipType,
        beneficiaryId: hasInvalidParent ? null : candidate.beneficiaryId,
        beneficiarySnapshot: snapshot,
        matchedPerson: candidate.matchedPerson,
        warnings: [...candidate.warnings],
        candidateMatches: candidates,
      };
    }

    return {
      verificationStatus: candidate.verificationType,
      relationshipType: candidate.relationshipType,
      beneficiaryId: candidate.beneficiaryId,
      beneficiarySnapshot: snapshot,
      matchedPerson: candidate.matchedPerson,
      warnings: [...candidate.warnings],
      candidateMatches: candidates,
    };
  }

  // Multiple candidates (Scenario E / duplicates / conflicts)
  const combinedWarnings: VerificationWarningCode[] = ["multiple_possible_matches"];
  addWarning(combinedWarnings, "duplicate_national_id");
  const distinctBeneficiaryIds = new Set(
    candidates.map((c) => c.beneficiaryId).filter(Boolean)
  );
  const distinctRelationshipTypes = new Set(
    candidates.map((c) => c.relationshipType)
  );

  if (distinctRelationshipTypes.size > 1) {
    addWarning(combinedWarnings, "conflicting_relationship_types");
  }
  for (const c of candidates) {
    for (const w of c.warnings) {
      addWarning(combinedWarnings, w);
    }
  }

  const singleBeneficiaryId =
    distinctBeneficiaryIds.size === 1 ? Array.from(distinctBeneficiaryIds)[0] : null;
  const singleRelType: ApplicantRelationshipType =
    distinctRelationshipTypes.size === 1
      ? Array.from(distinctRelationshipTypes)[0]
      : "unknown";

  const matchedRecord = singleBeneficiaryId
    ? records.find((r) => stringifyId(r._id) === singleBeneficiaryId)
    : undefined;

  const snapshot: BeneficiarySnapshot | null =
    singleBeneficiaryId && matchedRecord?.name?.trim()
      ? {
          name: matchedRecord.name.trim(),
          internalId: matchedRecord.internalId?.trim() || undefined,
          status: matchedRecord.status || undefined,
          branchId: stringifyId(matchedRecord.branch) || undefined,
          branchName: matchedRecord.branchName?.trim() || undefined,
        }
      : null;

  return {
    verificationStatus: "manual_review",
    relationshipType: singleRelType,
    beneficiaryId: singleBeneficiaryId,
    beneficiarySnapshot: snapshot,
    matchedPerson: null,
    warnings: combinedWarnings,
    candidateMatches: candidates,
  };
}

export type BeneficiaryLookupFn = (
  exactNationalId: string
) => Promise<LeanBeneficiaryForVerification[]>;

export interface VerificationBranchScopeOptions {
  branchId?: string | null;
  isZarqaBranch?: boolean;
}

/**
 * Verifies an applicant National ID against all National ID paths in MongoDB Beneficiaries.
 * When `branchId` is provided, restricts lookup strictly to that branch (plus legacy null/unassigned
 * records only for ZARQA default branch). Gracefully degrades to `manual_review` with
 * `verification_source_unavailable` on query errors.
 */
export async function verifyApplicantAgainstDatabase(
  applicantNationalId: string,
  customLookupFnOrOptions?: BeneficiaryLookupFn | VerificationBranchScopeOptions
): Promise<VerificationEvaluation> {
  const normalized = normalizeExactNationalId(applicantNationalId);
  if (!normalized) {
    return evaluateVerificationCandidates(applicantNationalId, []);
  }

  const customLookupFn =
    typeof customLookupFnOrOptions === "function"
      ? customLookupFnOrOptions
      : undefined;
  const branchOptions =
    customLookupFnOrOptions && typeof customLookupFnOrOptions === "object"
      ? customLookupFnOrOptions
      : undefined;

  try {
    let records: LeanBeneficiaryForVerification[];
    if (customLookupFn) {
      records = await customLookupFn(normalized);
    } else {
      const [{ isValidObjectId, Types }, { default: dbConnect }, { default: Beneficiary }] =
        await Promise.all([
          import("mongoose"),
          import("@/lib/mongodb"),
          import("@/lib/models/Beneficiary"),
        ]);
      await dbConnect();

      const nidOrCondition = {
        $or: [
          { nationalId: normalized },
          { "spouse.nationalId": normalized },
          { "children.nationalId": normalized },
          { "children.idNumber": normalized },
          { "children.spouse.nationalId": normalized },
          { "relationships.relativeNationalId": normalized },
        ],
      };

      let queryFilter: Record<string, unknown> = nidOrCondition;
      if (branchOptions?.branchId && isValidObjectId(branchOptions.branchId)) {
        const branchObjectId = new Types.ObjectId(branchOptions.branchId);
        const branchCondition = branchOptions.isZarqaBranch
          ? {
              $or: [
                { branch: branchObjectId },
                { branch: null },
                { branch: { $exists: false } },
              ],
            }
          : { branch: branchObjectId };
        queryFilter = { $and: [nidOrCondition, branchCondition] };
      }

      records = (await Beneficiary.find(queryFilter)
        .select(
          "_id name internalId nationalId maritalStatus status branch branchName spouse children relationships"
        )
        .lean()) as unknown as LeanBeneficiaryForVerification[];
    }

    return evaluateVerificationCandidates(normalized, records);
  } catch {
    return {
      verificationStatus: "manual_review",
      relationshipType: "unknown",
      beneficiaryId: null,
      beneficiarySnapshot: null,
      matchedPerson: null,
      warnings: ["verification_source_unavailable"],
      candidateMatches: [],
    };
  }
}
