import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Loan from "@/lib/models/Loan";
import LoanCapital from "@/lib/models/LoanCapital";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getBranchFilterWithOverride, getBranchFilter } from "@/lib/auth-helpers";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    // if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();

    // Parse query params for search/filter if needed
    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);
    
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const query: any = { deletedAt: null, ...branchFilter };

    if (search) {
      query.$or = [
        { beneficiaryName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { nationalId: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    // Fetch loans filtered by branch
    const loans = await Loan.find(query)
      .sort({ startDate: -1 })
      .populate("branch", "name code")
      .lean();

    // Calculate Summary Stats (filtered by branch)
    // 1. Total Fund (Capital) - must use same filter as loans for consistency
    const capitalFilter = getBranchFilterWithOverride(authResult, branchIdOverride);
    const capitalResult = await LoanCapital.aggregate([
      { $match: capitalFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalFund = capitalResult[0]?.total || 0;

    // 2. Total Disbursed (from ALL loans, even non-active ones, unless logic differs)
    const loanMatch = { deletedAt: null, ...branchFilter };
    const disbursedResult = await Loan.aggregate([
      { $match: loanMatch },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalDisbursed = disbursedResult[0]?.total || 0;

    // 3. Total Repaid
    const repaidResult = await Loan.aggregate([
      { $match: loanMatch },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]);
    const totalRepaid = repaidResult[0]?.total || 0;

    // 4. Available Fund
    const availableFund = totalFund - totalDisbursed + totalRepaid;

    return NextResponse.json({
      loans,
      stats: {
        totalFund,
        totalDisbursed,
        totalRepaid,
        availableFund,
      },
      branch: authResult.branchName,
      isSuperAdmin: authResult.isSuperAdmin,
    });
  } catch (error) {
    console.error("Error fetching loans:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const branchFilter = getBranchFilter(authResult);

    const body = await req.json();
    const { beneficiaryName, phone, nationalId, amount, startDate, dueDate, notes } = body;

    if (!beneficiaryName || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check available fund (filtered by branch)
    const capitalMatch = authResult.isSuperAdmin ? {} : { branch: authResult.branch };
    const capitalResult = await LoanCapital.aggregate([
      { $match: capitalMatch },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalFund = capitalResult[0]?.total || 0;

    const loanMatch = { deletedAt: null, ...branchFilter };
    const disbursedResult = await Loan.aggregate([
      { $match: loanMatch },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalDisbursed = disbursedResult[0]?.total || 0;

    const repaidResult = await Loan.aggregate([
      { $match: loanMatch },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]);
    const totalRepaid = repaidResult[0]?.total || 0;

    const availableFund = totalFund - totalDisbursed + totalRepaid;

    if (amount > availableFund) {
      return NextResponse.json(
        { error: "رصيد صندوق القرض الحسن لا يكفي لاتمام هذه العملية" },
        { status: 400 }
      );
    }

    // Determine target branch
    const targetBranch = authResult.isSuperAdmin ? body.branch : authResult.branch;
    const targetBranchName = authResult.isSuperAdmin ? body.branchName : authResult.branchName;

    // For SuperAdmin: require explicit branch selection
    if (authResult.isSuperAdmin && !targetBranch) {
      return NextResponse.json({ 
        error: "يجب اختيار الفرع قبل إضافة القرض" 
      }, { status: 400 });
    }

    const loan = await Loan.create({
      beneficiaryName,
      phone,
      nationalId,
      amount,
      startDate: startDate || new Date(),
      dueDate,
      notes,
      createdBy: userId,
      branch: targetBranch,
      branchName: targetBranchName,
    });

    // If nationalId is provided, try to link with Beneficiary
    if (nationalId) {
      await Beneficiary.findOneAndUpdate(
        { nationalId, branch: targetBranch },
        {
          $set: {
            loanDetails: {
              loanId: loan._id,
              amount: loan.amount,
              remainingAmount: loan.amount, // Initially, remaining = total amount
              startDate: loan.startDate,
              status: loan.status,
            }
          }
        }
      );
    }

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    console.error("Error creating loan:", error);
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500 }
    );
  }
}
