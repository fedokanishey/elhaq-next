import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Loan from "@/lib/models/Loan";
import LoanCapital from "@/lib/models/LoanCapital";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    // if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    // Parse query params for search/filter if needed
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const query: any = { deletedAt: null };

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

    // Fetch loans
    const loans = await Loan.find(query).sort({ startDate: -1 }).lean();

    // Calculate Summary Stats
    // 1. Total Fund (Capital)
    const capitalResult = await LoanCapital.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalFund = capitalResult[0]?.total || 0;

    // 2. Total Disbursed (from ALL loans, even non-active ones, unless logic differs)
    // Assuming disbursal is total loaned amount.
    const disbursedResult = await Loan.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalDisbursed = disbursedResult[0]?.total || 0;

    // 3. Total Repaid
    const repaidResult = await Loan.aggregate([
      { $match: { deletedAt: null } },
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

    // Assuming user details fetching logic if needed for 'recordedBy', using userId for now or fetching Clrek user
    // For now, simpler to just store user Id

    const body = await req.json();
    const { beneficiaryName, phone, nationalId, amount, startDate, dueDate, notes } = body;

    if (!beneficiaryName || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await dbConnect();

    // Check available fund
    const capitalResult = await LoanCapital.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]);
    const totalFund = capitalResult[0]?.total || 0;

    const disbursedResult = await Loan.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalDisbursed = disbursedResult[0]?.total || 0;

    const repaidResult = await Loan.aggregate([
      { $match: { deletedAt: null } },
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

    const loan = await Loan.create({
      beneficiaryName,
      phone,
      nationalId,
      amount,
      startDate: startDate || new Date(),
      dueDate,
      notes,
      createdBy: userId,
    });

    // If nationalId is provided, try to link with Beneficiary
    if (nationalId) {
      await Beneficiary.findOneAndUpdate(
        { nationalId },
        {
          $set: {
            loanDetails: {
              loanId: loan._id,
              amount: loan.amount,
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
