import { isValidObjectId, Types } from "mongoose";
import AccountCategory from "@/lib/models/AccountCategory";

export const DEFAULT_ACCOUNT_CATEGORY = "زكاة مال";

export const normalizeCategoryName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const toBranchObjectId = (branch?: string | Types.ObjectId | null) => {
  if (!branch) return null;
  try {
    return new Types.ObjectId(branch.toString());
  } catch (e) {
    return null;
  }
};

export async function ensureAccountCategory(params: {
  name?: string;
  branch?: string | Types.ObjectId | null;
  branchName?: string | null;
  createdBy?: string;
}) {
  const cleanedName = (params.name || "").trim() || DEFAULT_ACCOUNT_CATEGORY;
  const normalizedName = normalizeCategoryName(cleanedName);
  const branch = toBranchObjectId(params.branch);

  return AccountCategory.findOneAndUpdate(
    {
      normalizedName,
      branch,
    },
    {
      $setOnInsert: {
        name: cleanedName,
        normalizedName,
        branch,
        branchName: params.branchName || null,
        createdBy: params.createdBy,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}
