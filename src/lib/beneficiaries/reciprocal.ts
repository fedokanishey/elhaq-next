import Beneficiary from "@/lib/models/Beneficiary";
import dbConnect from "@/lib/mongodb";
import { Types } from "mongoose";

export type RelationshipType =
  | "father"
  | "mother"
  | "son"
  | "daughter"
  | "brother"
  | "sister"
  | "spouse"
  | "grandfather"
  | "grandmother"
  | "other";

export function inverseRelation(rel: RelationshipType): RelationshipType {
  switch (rel) {
    case "father":
      return "son";
    case "mother":
      return "daughter";
    case "son":
      return "father";
    case "daughter":
      return "mother";
    case "brother":
      return "brother";
    case "sister":
      return "sister";
    case "spouse":
      return "spouse";
    case "grandfather":
    case "grandmother":
      // no explicit grandchild type in schema; use other as fallback
      return "other";
    default:
      return "other";
  }
}

interface ResolvedRelationship {
  relation: RelationshipType;
  relativeName?: string;
  relativeNationalId?: string;
  relative?: string; // relative beneficiary id as string
}

// Add reciprocal entries on related beneficiaries for a newly created beneficiary
export async function addReciprocalRelationsForNew(
  beneficiaryId: string,
  beneficiaryName: string,
  beneficiaryNationalId: string,
  resolvedRelationships: ResolvedRelationship[]
) {
  if (!resolvedRelationships || !resolvedRelationships.length) return;
  await dbConnect();

  for (const rel of resolvedRelationships) {
    const otherId = rel.relative;
    if (!otherId) continue;
    try {
      const inv = inverseRelation(rel.relation as RelationshipType);
      // Use $addToSet to avoid duplicates
      await Beneficiary.findByIdAndUpdate(otherId, {
        $addToSet: {
          relationships: {
            relation: inv,
            relativeName: beneficiaryName,
            relativeNationalId: beneficiaryNationalId,
            relative: new Types.ObjectId(beneficiaryId),
          },
        },
      });
    } catch (e) {
      // continue on errors
      // eslint-disable-next-line no-console
      console.error("Failed to add reciprocal relation:", e);
    }
  }
}

// Sync reciprocals when updating: remove old ones that were removed, add new ones
export async function syncReciprocalRelations(
  beneficiaryId: string,
  beneficiaryName: string,
  beneficiaryNationalId: string,
  oldResolved: ResolvedRelationship[],
  newResolved: ResolvedRelationship[]
) {
  await dbConnect();

  const oldMap = new Map<string, ResolvedRelationship>();
  for (const r of oldResolved || []) {
    if (r.relative) oldMap.set(r.relative, r);
  }

  const newMap = new Map<string, ResolvedRelationship>();
  for (const r of newResolved || []) {
    if (r.relative) newMap.set(r.relative, r);
  }

  // Removed relations: in oldMap but not in newMap
  for (const [otherId, oldRel] of oldMap.entries()) {
    if (!newMap.has(otherId)) {
      try {
        const inv = inverseRelation(oldRel.relation as RelationshipType);
        // Remove the reciprocal relationship from the other beneficiary
        await Beneficiary.findByIdAndUpdate(otherId, {
          $pull: {
            relationships: {
              relative: new Types.ObjectId(beneficiaryId),
              relation: inv,
            },
          },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to remove reciprocal relation:", e);
      }
    }
  }

  // New relations: in newMap but not in oldMap
  for (const [otherId, newRel] of newMap.entries()) {
    if (!oldMap.has(otherId)) {
      try {
        const inv = inverseRelation(newRel.relation as RelationshipType);
        await Beneficiary.findByIdAndUpdate(otherId, {
          $addToSet: {
            relationships: {
              relation: inv,
              relativeName: beneficiaryName,
              relativeNationalId: beneficiaryNationalId,
              relative: new Types.ObjectId(beneficiaryId),
            },
          },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to add reciprocal relation on update:", e);
      }
    }
  }
}

export default {};
