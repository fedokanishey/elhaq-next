import { auth, clerkClient } from "@clerk/nextjs/server";
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

const SUPER_ADMIN_EMAIL = "kanishey@gmail.com";

/**
 * POST: Initialize the multi-branch system
 * - Create default branch "الزرقا"
 * - Set kanishey@gmail.com as superadmin
 * - Assign all existing users to default branch
 * - Assign all existing data to default branch
 */
export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Step 1: Create default branch "الزرقا" if not exists
    let defaultBranch = await Branch.findOne({ code: 'ZARQA' });
    if (!defaultBranch) {
      defaultBranch = await Branch.create({
        name: 'الزرقا',
        code: 'ZARQA',
        address: 'فرع الزرقا - دمياط',
        isActive: true,
      });
      console.log('✅ Created default branch: الزرقا');
    } else {
      console.log('ℹ️ Default branch already exists');
    }

    // Step 2: Find and update the superadmin user
    let superAdmin = await User.findOne({ email: SUPER_ADMIN_EMAIL });
    
    if (superAdmin) {
      // Update to superadmin role and remove branch
      superAdmin = await User.findByIdAndUpdate(
        superAdmin._id,
        { 
          role: 'superadmin',
          $unset: { branch: 1, branchName: 1 }
        },
        { new: true }
      );

      // Also update Clerk metadata
      if (superAdmin.clerkId) {
        try {
          const client = await clerkClient();
          await client.users.updateUserMetadata(superAdmin.clerkId, {
            publicMetadata: {
              role: "superadmin",
            },
          });
          console.log('✅ Updated Clerk metadata for superadmin');
        } catch (clerkError) {
          console.error("Error updating Clerk metadata:", clerkError);
        }
      }
      console.log('✅ Updated superadmin:', SUPER_ADMIN_EMAIL);
    } else {
      console.log('⚠️ Superadmin user not found. They need to log in first.');
    }

    // Step 3: Update all users (except superadmin) to default branch
    const usersResult = await User.updateMany(
      { 
        branch: { $exists: false },
        role: { $ne: 'superadmin' }
      },
      { 
        branch: defaultBranch._id,
        branchName: defaultBranch.name 
      }
    );
    console.log(`✅ Updated ${usersResult.modifiedCount} users with default branch`);

    // Step 4: Update all existing data to default branch
    const beneficiariesResult = await Beneficiary.updateMany(
      { branch: { $exists: false } },
      { branch: defaultBranch._id, branchName: defaultBranch.name }
    );
    console.log(`✅ Updated ${beneficiariesResult.modifiedCount} beneficiaries`);

    const initiativesResult = await Initiative.updateMany(
      { branch: { $exists: false } },
      { branch: defaultBranch._id, branchName: defaultBranch.name }
    );
    console.log(`✅ Updated ${initiativesResult.modifiedCount} initiatives`);

    const loansResult = await Loan.updateMany(
      { branch: { $exists: false } },
      { branch: defaultBranch._id, branchName: defaultBranch.name }
    );
    console.log(`✅ Updated ${loansResult.modifiedCount} loans`);

    const loanCapitalsResult = await LoanCapital.updateMany(
      { branch: { $exists: false } },
      { branch: defaultBranch._id, branchName: defaultBranch.name }
    );
    console.log(`✅ Updated ${loanCapitalsResult.modifiedCount} loan capitals`);

    const treasuryResult = await TreasuryTransaction.updateMany(
      { branch: { $exists: false } },
      { branch: defaultBranch._id, branchName: defaultBranch.name }
    );
    console.log(`✅ Updated ${treasuryResult.modifiedCount} treasury transactions`);

    const donorsResult = await Donor.updateMany(
      { branch: { $exists: false } },
      { branch: defaultBranch._id, branchName: defaultBranch.name }
    );
    console.log(`✅ Updated ${donorsResult.modifiedCount} donors`);

    const warehouseResult = await WarehouseMovement.updateMany(
      { branch: { $exists: false } },
      { branch: defaultBranch._id, branchName: defaultBranch.name }
    );
    console.log(`✅ Updated ${warehouseResult.modifiedCount} warehouse movements`);

    return NextResponse.json({
      success: true,
      message: "تم تهيئة نظام الفروع المتعددة بنجاح",
      data: {
        defaultBranch: {
          id: defaultBranch._id,
          name: defaultBranch.name,
          code: defaultBranch.code,
        },
        superAdmin: superAdmin ? {
          email: superAdmin.email,
          role: superAdmin.role,
        } : null,
        updates: {
          users: usersResult.modifiedCount,
          beneficiaries: beneficiariesResult.modifiedCount,
          initiatives: initiativesResult.modifiedCount,
          loans: loansResult.modifiedCount,
          loanCapitals: loanCapitalsResult.modifiedCount,
          treasuryTransactions: treasuryResult.modifiedCount,
          donors: donorsResult.modifiedCount,
          warehouseMovements: warehouseResult.modifiedCount,
        }
      }
    });
  } catch (error) {
    console.error("Error initializing multi-branch system:", error);
    return NextResponse.json({ 
      error: "Failed to initialize multi-branch system",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * GET: Check initialization status
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const defaultBranch = await Branch.findOne({ code: 'ZARQA' });
    const superAdmin = await User.findOne({ email: SUPER_ADMIN_EMAIL });
    const branchCount = await Branch.countDocuments();
    const usersWithoutBranch = await User.countDocuments({ 
      branch: { $exists: false },
      role: { $ne: 'superadmin' }
    });
    const beneficiariesWithoutBranch = await Beneficiary.countDocuments({ 
      branch: { $exists: false } 
    });

    return NextResponse.json({
      isInitialized: !!defaultBranch && superAdmin?.role === 'superadmin',
      defaultBranch: defaultBranch ? {
        id: defaultBranch._id,
        name: defaultBranch.name,
        code: defaultBranch.code,
      } : null,
      superAdmin: superAdmin ? {
        email: superAdmin.email,
        role: superAdmin.role,
      } : null,
      stats: {
        totalBranches: branchCount,
        usersWithoutBranch,
        beneficiariesWithoutBranch,
      }
    });
  } catch (error) {
    console.error("Error checking initialization status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
