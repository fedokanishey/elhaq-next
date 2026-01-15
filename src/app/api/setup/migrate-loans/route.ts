import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Branch from "@/lib/models/Branch";
import Loan from "@/lib/models/Loan";
import LoanCapital from "@/lib/models/LoanCapital";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * POST: Migrate orphaned loan data to a specific branch (default: الزرقا)
 * This fixes data that was created before the multi-branch system was implemented
 * 
 * Only SuperAdmin can run this migration
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.isSuperAdmin) {
      return NextResponse.json({ error: "Only SuperAdmin can run migrations" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const targetBranchCode = body.branchCode || "ZARQA"; // Default to الزرقا

    // Find the target branch
    const targetBranch = await Branch.findOne({ 
      $or: [
        { code: targetBranchCode },
        { code: "ZARQA" },
        { name: "الزرقا" }
      ]
    });

    if (!targetBranch) {
      return NextResponse.json({ 
        error: "لم يتم العثور على الفرع المستهدف. تأكد من وجود فرع الزرقا." 
      }, { status: 404 });
    }

    const results = {
      loans: { found: 0, updated: 0 },
      loanCapital: { found: 0, updated: 0 },
      targetBranch: {
        id: targetBranch._id.toString(),
        name: targetBranch.name,
        code: targetBranch.code,
      }
    };

    // 1. Migrate orphaned Loans (no branch assigned)
    const orphanedLoans = await Loan.find({ 
      branch: { $exists: false } 
    }).countDocuments();
    results.loans.found = orphanedLoans;

    if (orphanedLoans > 0) {
      const loansUpdateResult = await Loan.updateMany(
        { branch: { $exists: false } },
        { 
          $set: { 
            branch: targetBranch._id, 
            branchName: targetBranch.name 
          } 
        }
      );
      results.loans.updated = loansUpdateResult.modifiedCount;
    }

    // Also migrate loans with null branch
    const nullBranchLoans = await Loan.find({ 
      branch: null 
    }).countDocuments();
    
    if (nullBranchLoans > 0) {
      const nullLoansResult = await Loan.updateMany(
        { branch: null },
        { 
          $set: { 
            branch: targetBranch._id, 
            branchName: targetBranch.name 
          } 
        }
      );
      results.loans.found += nullBranchLoans;
      results.loans.updated += nullLoansResult.modifiedCount;
    }

    // 2. Migrate orphaned LoanCapital (no branch assigned)
    const orphanedCapitals = await LoanCapital.find({ 
      branch: { $exists: false } 
    }).countDocuments();
    results.loanCapital.found = orphanedCapitals;

    if (orphanedCapitals > 0) {
      const capitalUpdateResult = await LoanCapital.updateMany(
        { branch: { $exists: false } },
        { 
          $set: { 
            branch: targetBranch._id, 
            branchName: targetBranch.name 
          } 
        }
      );
      results.loanCapital.updated = capitalUpdateResult.modifiedCount;
    }

    // Also migrate capitals with null branch
    const nullBranchCapitals = await LoanCapital.find({ 
      branch: null 
    }).countDocuments();
    
    if (nullBranchCapitals > 0) {
      const nullCapitalResult = await LoanCapital.updateMany(
        { branch: null },
        { 
          $set: { 
            branch: targetBranch._id, 
            branchName: targetBranch.name 
          } 
        }
      );
      results.loanCapital.found += nullBranchCapitals;
      results.loanCapital.updated += nullCapitalResult.modifiedCount;
    }

    console.log("✅ Loan data migration completed:", results);

    return NextResponse.json({
      success: true,
      message: `تم ترحيل البيانات إلى فرع ${targetBranch.name}`,
      results,
    });

  } catch (error) {
    console.error("Error during loan migration:", error);
    return NextResponse.json({ 
      error: "فشل ترحيل البيانات",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * GET: Check current state of orphaned loan data
 */
export async function GET() {
  try {
    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.isSuperAdmin) {
      return NextResponse.json({ error: "Only SuperAdmin can check migrations" }, { status: 403 });
    }

    // Count orphaned records
    const orphanedLoans = await Loan.countDocuments({ 
      $or: [
        { branch: { $exists: false } },
        { branch: null }
      ]
    });

    const orphanedCapitals = await LoanCapital.countDocuments({ 
      $or: [
        { branch: { $exists: false } },
        { branch: null }
      ]
    });

    // Get all loans grouped by branch
    const loansByBranch = await Loan.aggregate([
      { $match: { deletedAt: null } },
      { 
        $group: { 
          _id: "$branchName", 
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        } 
      }
    ]);

    const capitalsByBranch = await LoanCapital.aggregate([
      { 
        $group: { 
          _id: "$branchName", 
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        } 
      }
    ]);

    return NextResponse.json({
      orphaned: {
        loans: orphanedLoans,
        loanCapital: orphanedCapitals,
      },
      byBranch: {
        loans: loansByBranch,
        loanCapital: capitalsByBranch,
      },
      needsMigration: orphanedLoans > 0 || orphanedCapitals > 0,
    });

  } catch (error) {
    console.error("Error checking migration status:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
