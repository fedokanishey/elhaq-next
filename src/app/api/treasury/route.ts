import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import Donor from "@/lib/models/Donor";
import Beneficiary from "@/lib/models/Beneficiary";
import Notebook from "@/lib/models/Notebook";
import { isValidObjectId } from "mongoose";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";
import { ensureAccountCategory } from "@/lib/account-categories";
import { createActivityNotification } from "@/lib/notifications";

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
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 0; // 0 means no limit

    // Use the same branchFilter for both transactions query and aggregation
    // This ensures consistent results between transactions list and summary totals
    const [transactions, summary] = await Promise.all([
      limit > 0 
        ? TreasuryTransaction.find(branchFilter)
            .sort({ transactionDate: -1, createdAt: -1 })
            .limit(limit)
            .lean()
        : TreasuryTransaction.find(branchFilter)
            .sort({ transactionDate: -1, createdAt: -1 })
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
      notebookId,
      notebookName,
      beneficiaryIds,
      beneficiaryShares,
      isMonthlyAllowance,
    } = body;

    const normalizedType = type === "expense" ? "expense" : type === "income" ? "income" : null;
    const normalizedAmount = Number(amount);
    const normalizedCategory = typeof category === "string" ? category.trim() : "";

    if (!normalizedType || !description || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return NextResponse.json({ error: "Invalid transaction payload" }, { status: 400 });
    }

    if (!normalizedCategory) {
      return NextResponse.json({ error: "فئة الحساب مطلوبة" }, { status: 400 });
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

    // Resolve notebook for income transactions
    let resolvedNotebook: { _id: string; name: string } | null = null;
    const trimmedNotebookName = typeof notebookName === "string" ? notebookName.trim() : "";

    if ((trimmedNotebookName || notebookId)) {
      if (notebookId && isValidObjectId(notebookId)) {
        const notebook = await Notebook.findById(notebookId).lean();
        if (notebook) {
          resolvedNotebook = { _id: notebook._id.toString(), name: notebook.name };
        }
      }

      if (!resolvedNotebook && trimmedNotebookName) {
        const normalizedName = trimmedNotebookName.toLowerCase();
        // Search for notebook within the TARGET branch
        const notebookQuery = { nameNormalized: normalizedName, branch: targetBranch };
        let notebook = await Notebook.findOne(notebookQuery);
        if (!notebook) {
          // Create notebook in the TARGET branch
          notebook = await Notebook.create({
            name: trimmedNotebookName,
            nameNormalized: normalizedName,
            type: normalizedType === "income" ? "income" : normalizedType === "expense" ? "expense" : "all",
            branch: targetBranch,
            branchName: targetBranchName,
          });
        }
        resolvedNotebook = { _id: notebook._id.toString(), name: notebook.name };
      }

      // Update notebook stats
      if (resolvedNotebook) {
        const amountChange = normalizedType === "income" ? normalizedAmount : -normalizedAmount;
        await Notebook.findByIdAndUpdate(resolvedNotebook._id, {
          $inc: {
            transactionsCount: 1,
            totalAmount: amountChange,
          },
          $set: {
            lastUsedDate: transactionDate ? new Date(transactionDate) : new Date(),
          },
        });
      }
    }

    // Resolve beneficiaries, shares, and snapshots for expense transactions
    const resolvedBeneficiaryIds = normalizedType === "expense" && Array.isArray(beneficiaryIds) 
      ? beneficiaryIds.filter((id: string) => isValidObjectId(id))
      : [];

    let resolvedShares: { beneficiaryId: any; name: string; amount: number }[] = [];
    let beneficiaryNamesSnapshot: string[] = [];
    const isMonthly = Boolean(
      isMonthlyAllowance ||
      (normalizedCategory && (normalizedCategory.includes("شهرية") || normalizedCategory.includes("شهريات"))) ||
      (description && (description.includes("شهرية") || description.includes("شهريات")))
    );

    if (normalizedType === "expense" && resolvedBeneficiaryIds.length > 0) {
      const beneficiariesList = await Beneficiary.find({
        _id: { $in: resolvedBeneficiaryIds }
      }).select("_id name monthlyAllowanceAmount receivesMonthlyAllowance").lean();

      beneficiaryNamesSnapshot = beneficiariesList.map((b: any) => b.name);

      if (Array.isArray(beneficiaryShares) && beneficiaryShares.length > 0) {
        resolvedShares = beneficiaryShares
          .filter((s: any) => s && isValidObjectId(s.beneficiaryId))
          .map((s: any) => {
            const ben = beneficiariesList.find((b: any) => b._id.toString() === s.beneficiaryId.toString());
            return {
              beneficiaryId: s.beneficiaryId,
              name: s.name || ben?.name || "",
              amount: Number(s.amount) || 0,
            };
          });
      } else if (isMonthly) {
        resolvedShares = beneficiariesList.map((b: any) => ({
          beneficiaryId: b._id,
          name: b.name,
          amount: Number(b.monthlyAllowanceAmount) || 0,
        }));
      } else {
        const equalShare = normalizedAmount / resolvedBeneficiaryIds.length;
        resolvedShares = beneficiariesList.map((b: any) => ({
          beneficiaryId: b._id,
          name: b.name,
          amount: equalShare,
        }));
      }

      // Update each beneficiary with their exact share
      await Promise.all(
        resolvedShares.map(async (share) => {
          await Beneficiary.findByIdAndUpdate(share.beneficiaryId, {
            $inc: {
              totalReceived: share.amount,
              financialAidCount: 1,
            },
            $set: {
              lastFinancialAidDate: transactionDate ? new Date(transactionDate) : new Date(),
            },
          });
        })
      );
    }

    await ensureAccountCategory({
      name: normalizedCategory,
      branch: targetBranch,
      branchName: targetBranchName,
      createdBy: userId,
    });

    const entry: any = await (TreasuryTransaction as any).create({
      amount: normalizedAmount,
      type: normalizedType,
      description: description.trim(),
      category: normalizedCategory,
      reference: reference?.trim(),
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      createdBy: userId,
      recordedBy: recordedBy?.trim(),
      donorId: resolvedDonor?._id,
      donorNameSnapshot: resolvedDonor?.name || trimmedDonorName || undefined,
      notebookId: resolvedNotebook?._id,
      notebookNameSnapshot: resolvedNotebook?.name || trimmedNotebookName || undefined,
      beneficiaryIds: resolvedBeneficiaryIds,
      beneficiaryNamesSnapshot,
      beneficiaryShares: resolvedShares,
      isMonthlyAllowance: isMonthly,
      branch: targetBranch,
      branchName: targetBranchName,
    });

    await createActivityNotification({
      authResult,
      actionType:
        normalizedType === "income"
          ? "treasury_income_created"
          : "treasury_expense_created",
      message:
        normalizedType === "income"
          ? `تم تسجيل وارد بقيمة ${normalizedAmount.toLocaleString("ar-EG")} ج.م`
          : `تم تسجيل مصروف بقيمة ${normalizedAmount.toLocaleString("ar-EG")} ج.م`,
      actorName: recordedBy?.trim(),
      entityId: entry._id.toString(),
      metadata: {
        amount: normalizedAmount,
        category: normalizedCategory,
        description: description.trim(),
      },
      branch: targetBranch,
      branchName: targetBranchName,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    console.error("Error recording treasury transaction:", error);
    return NextResponse.json({ error: "Failed to record transaction", details: error?.message || String(error) }, { status: 500 });
  }
}
