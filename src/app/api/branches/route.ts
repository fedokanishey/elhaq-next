import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Branch from "@/lib/models/Branch";
import User from "@/lib/models/User";
import Beneficiary from "@/lib/models/Beneficiary";
import Initiative from "@/lib/models/Initiative";
import Loan from "@/lib/models/Loan";
import LoanCapital from "@/lib/models/LoanCapital";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import Donor from "@/lib/models/Donor";
import WarehouseMovement from "@/lib/models/WarehouseMovement";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// GET: List all branches (SuperAdmin only, or own branch for others)
export async function GET() {
  try {
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    if (authResult.isSuperAdmin) {
      // SuperAdmin can see all branches
      const branches = await Branch.find({}).sort({ createdAt: -1 });
      return NextResponse.json({ branches });
    } else if (authResult.isAuthorized && authResult.branch) {
      // Others can only see their own branch
      const branch = await Branch.findById(authResult.branch);
      return NextResponse.json({ branches: branch ? [branch] : [] });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Create new branch (SuperAdmin only)
export async function POST(req: Request) {
  try {
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!authResult.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden - SuperAdmin only" }, { status: 403 });
    }

    await dbConnect();

    const { name, code, address, phone } = await req.json();

    if (!name || !code) {
      return NextResponse.json({ error: "Name and code are required" }, { status: 400 });
    }

    // Check if branch with same code exists
    const existingBranch = await Branch.findOne({ 
      $or: [{ code: code.toUpperCase() }, { name }] 
    });
    
    if (existingBranch) {
      return NextResponse.json({ 
        error: "فرع بنفس الاسم أو الكود موجود بالفعل" 
      }, { status: 400 });
    }

    const branch = await Branch.create({
      name,
      code: code.toUpperCase(),
      address,
      phone,
      isActive: true,
    });

    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    console.error("Error creating branch:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Initialize system - Create default branch and set superadmin
export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { superAdminEmail, initializeExistingData } = await req.json();

    if (!superAdminEmail) {
      return NextResponse.json({ error: "superAdminEmail is required" }, { status: 400 });
    }

    // Create default branch "الزرقا" if not exists
    let defaultBranch = await Branch.findOne({ code: 'ZARQA' });
    if (!defaultBranch) {
      defaultBranch = await Branch.create({
        name: 'الزرقا',
        code: 'ZARQA',
        address: 'فرع الزرقا - دمياط',
        isActive: true,
      });
    }

    // Set the superadmin
    const superAdmin = await User.findOneAndUpdate(
      { email: superAdminEmail },
      { 
        role: 'superadmin',
        $unset: { branch: 1, branchName: 1 } // SuperAdmin doesn't need a branch
      },
      { new: true }
    );

    if (!superAdmin) {
      return NextResponse.json({ 
        error: `User with email ${superAdminEmail} not found. Make sure they have logged in at least once.` 
      }, { status: 404 });
    }

    // Update all existing users (except superadmin) to default branch if no branch set
    const usersUpdated = await User.updateMany(
      { 
        branch: { $exists: false },
        role: { $ne: 'superadmin' }
      },
      { 
        branch: defaultBranch._id,
        branchName: defaultBranch.name 
      }
    );

    const dataUpdated = {
      beneficiaries: 0,
      initiatives: 0,
      loans: 0,
      loanCapitals: 0,
      treasuryTransactions: 0,
      donors: 0,
      warehouseMovements: 0,
    };

    // Optionally update all existing data to default branch
    if (initializeExistingData) {
      const beneficiariesResult = await Beneficiary.updateMany(
        { branch: { $exists: false } },
        { branch: defaultBranch._id, branchName: defaultBranch.name }
      );
      dataUpdated.beneficiaries = beneficiariesResult.modifiedCount;

      const initiativesResult = await Initiative.updateMany(
        { branch: { $exists: false } },
        { branch: defaultBranch._id, branchName: defaultBranch.name }
      );
      dataUpdated.initiatives = initiativesResult.modifiedCount;

      const loansResult = await Loan.updateMany(
        { branch: { $exists: false } },
        { branch: defaultBranch._id, branchName: defaultBranch.name }
      );
      dataUpdated.loans = loansResult.modifiedCount;

      const loanCapitalsResult = await LoanCapital.updateMany(
        { branch: { $exists: false } },
        { branch: defaultBranch._id, branchName: defaultBranch.name }
      );
      dataUpdated.loanCapitals = loanCapitalsResult.modifiedCount;

      const treasuryResult = await TreasuryTransaction.updateMany(
        { branch: { $exists: false } },
        { branch: defaultBranch._id, branchName: defaultBranch.name }
      );
      dataUpdated.treasuryTransactions = treasuryResult.modifiedCount;

      const donorsResult = await Donor.updateMany(
        { branch: { $exists: false } },
        { branch: defaultBranch._id, branchName: defaultBranch.name }
      );
      dataUpdated.donors = donorsResult.modifiedCount;

      const warehouseResult = await WarehouseMovement.updateMany(
        { branch: { $exists: false } },
        { branch: defaultBranch._id, branchName: defaultBranch.name }
      );
      dataUpdated.warehouseMovements = warehouseResult.modifiedCount;
    }

    return NextResponse.json({
      success: true,
      message: "System initialized successfully",
      defaultBranch,
      superAdmin: {
        email: superAdmin.email,
        role: superAdmin.role,
      },
      usersUpdated: usersUpdated.modifiedCount,
      dataUpdated,
    });
  } catch (error) {
    console.error("Error initializing system:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
