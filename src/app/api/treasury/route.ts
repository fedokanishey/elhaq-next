import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import Donor from "@/lib/models/Donor";
import Beneficiary from "@/lib/models/Beneficiary";
import { isValidObjectId } from "mongoose";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  try {
    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

    // Use the same branchFilter for both transactions query and aggregation
    // This ensures consistent results between transactions list and summary totals
    const [transactions, summary] = await Promise.all([
      TreasuryTransaction.find(branchFilter)
        .sort({ transactionDate: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
      TreasuryTransaction.aggregate([
        { $match: branchFilter },
        {
          $group: {
            _id: null,
            incomeTotal: {
              $sum: {
                $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
              },
            },
            expenseTotal: {
              $sum: {
                $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
              },
            },
          },
        },
      ]),
    ]);

    const incomeTotal = summary[0]?.incomeTotal ?? 0;
    const expenseTotal = summary[0]?.expenseTotal ?? 0;
    const balance = incomeTotal - expenseTotal;

    return NextResponse.json({
      totals: {
        incomeTotal,
        expenseTotal,
        balance,
      },
      transactions,
      branch: authResult.branchName,
    });
  } catch (error) {
    console.error("Error fetching treasury data:", error);
    return NextResponse.json({ error: "Failed to fetch treasury data" }, { status: 500 });
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
    const {
      amount,
      type,
      description,
      category,
      reference,
      transactionDate,
      recordedBy,
      donorId,
      donorName,
      beneficiaryIds,
    } = body;

    const normalizedType = type === "expense" ? "expense" : type === "income" ? "income" : null;
    const normalizedAmount = Number(amount);

    if (!normalizedType || !description || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return NextResponse.json({ error: "Invalid transaction payload" }, { status: 400 });
    }

    // Determine target branch FIRST - before donor handling
    const targetBranch = authResult.isSuperAdmin ? body.branch : authResult.branch;
    const targetBranchName = authResult.isSuperAdmin ? body.branchName : authResult.branchName;

    // For SuperAdmin: require explicit branch selection
    if (authResult.isSuperAdmin && !targetBranch) {
      return NextResponse.json({ 
        error: "يجب اختيار الفرع قبل إضافة العملية" 
      }, { status: 400 });
    }

    let resolvedDonor: { _id: string; name: string } | null = null;
    const trimmedDonorName = typeof donorName === "string" ? donorName.trim() : "";

    if (normalizedType === "income") {
      if (!trimmedDonorName && !donorId) {
        return NextResponse.json({ error: "يجب إضافة اسم المتبرع للوارد" }, { status: 400 });
      }

      if (donorId && isValidObjectId(donorId)) {
        const donor = await Donor.findById(donorId).lean();
        if (donor) {
          resolvedDonor = { _id: donor._id.toString(), name: donor.name };
        }
      }

      if (!resolvedDonor && trimmedDonorName) {
        const normalizedName = trimmedDonorName.toLowerCase();
        // Search for donor within the TARGET branch (not user's branch)
        const donorQuery = { nameNormalized: normalizedName, branch: targetBranch };
        let donor = await Donor.findOne(donorQuery);
        if (!donor) {
          // Create donor in the TARGET branch
          donor = await Donor.create({
            name: trimmedDonorName,
            nameNormalized: normalizedName,
            branch: targetBranch,
            branchName: targetBranchName,
          });
        }
        resolvedDonor = { _id: donor._id.toString(), name: donor.name };
      }

      if (!resolvedDonor) {
        return NextResponse.json({ error: "تعذر تحديد المتبرع" }, { status: 400 });
      }

      await Donor.findByIdAndUpdate(resolvedDonor._id, {
          $inc: {
            totalDonated: normalizedAmount,
            donationsCount: 1,
          },
          $set: {
            lastDonationDate: transactionDate ? new Date(transactionDate) : new Date(),
          },
        });
    }

    // Resolve beneficiary names snapshot
    const resolvedBeneficiaryIds = normalizedType === "expense" && Array.isArray(beneficiaryIds) 
      ? beneficiaryIds.filter((id: string) => isValidObjectId(id))
      : [];
    const beneficiaryNamesSnapshot = normalizedType === "expense" && resolvedBeneficiaryIds.length > 0
      ? (await Promise.all(
          resolvedBeneficiaryIds.map((id: string) => Beneficiary.findById(id).lean().then(b => b?.name || '').catch(() => ''))
        )).filter(Boolean)
      : [];

    const entry = await TreasuryTransaction.create({
      amount: normalizedAmount,
      type: normalizedType,
      description: description.trim(),
      category: category?.trim() || "general",
      reference: reference?.trim(),
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      createdBy: userId,
      recordedBy: recordedBy?.trim(),
      donorId: resolvedDonor?._id,
      donorNameSnapshot: resolvedDonor?.name || trimmedDonorName || undefined,
      beneficiaryIds: resolvedBeneficiaryIds,
      beneficiaryNamesSnapshot,
      branch: targetBranch,
      branchName: targetBranchName,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error recording treasury transaction:", error);
    return NextResponse.json({ error: "Failed to record transaction" }, { status: 500 });
  }
}
