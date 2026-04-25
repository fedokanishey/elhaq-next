import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import AccountCategory from "@/lib/models/AccountCategory";
import {
  DEFAULT_ACCOUNT_CATEGORY,
  ensureAccountCategory,
  normalizeCategoryName,
} from "@/lib/account-categories";
import {
  getAuthenticatedUser,
  getBranchFilterWithOverride,
} from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  try {
    await dbConnect();

    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    const categories = await AccountCategory.find(branchFilter)
      .sort({ name: 1 })
      .lean();

    const uniqueByNormalized = new Map<
      string,
      { _id?: string; name: string }
    >();

    for (const category of categories) {
      if (!uniqueByNormalized.has(category.normalizedName)) {
        uniqueByNormalized.set(category.normalizedName, {
          _id: category._id.toString(),
          name: category.name,
        });
      }
    }

    const defaultNormalized = normalizeCategoryName(DEFAULT_ACCOUNT_CATEGORY);
    if (!uniqueByNormalized.has(defaultNormalized)) {
      uniqueByNormalized.set(defaultNormalized, { name: DEFAULT_ACCOUNT_CATEGORY });
    }

    const payload = Array.from(uniqueByNormalized.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ar")
    );

    return NextResponse.json({ categories: payload });
  } catch (error) {
    console.error("Error fetching account categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch account categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const rawName = typeof body.name === "string" ? body.name.trim() : "";

    if (!rawName) {
      return NextResponse.json(
        { error: "اسم فئة الحساب مطلوب" },
        { status: 400 }
      );
    }

    const targetBranch = authResult.isSuperAdmin
      ? body.branch || authResult.branch
      : authResult.branch;
    const targetBranchName = authResult.isSuperAdmin
      ? body.branchName || authResult.branchName
      : authResult.branchName;

    const category = await ensureAccountCategory({
      name: rawName,
      branch: targetBranch,
      branchName: targetBranchName,
      createdBy: authResult.userId || undefined,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating account category:", error);
    return NextResponse.json(
      { error: "Failed to create account category" },
      { status: 500 }
    );
  }
}
