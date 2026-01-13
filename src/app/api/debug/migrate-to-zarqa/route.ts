import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Branch from "@/lib/models/Branch";
import Beneficiary from "@/lib/models/Beneficiary";
import Initiative from "@/lib/models/Initiative";
import User from "@/lib/models/User";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import WarehouseMovement from "@/lib/models/WarehouseMovement";
import Loan from "@/lib/models/Loan";
import LoanCapital from "@/lib/models/LoanCapital";
import Donor from "@/lib/models/Donor";

// Migrate all existing data to "الزرقا" branch
export async function GET() {
  try {
    await dbConnect();
    
    // 1. Create or get "الزرقا" branch
    let zarqaBranch = await Branch.findOne({ code: 'ZARQA' });
    
    if (!zarqaBranch) {
      zarqaBranch = await Branch.create({
        name: 'الزرقا',
        code: 'ZARQA',
        address: 'فرع الزرقا - دعوة الحق',
        isActive: true,
      });
    }
    
    const branchId = zarqaBranch._id;
    const branchName = zarqaBranch.name;
    
    const branchFilter = { 
      $or: [
        { branch: { $exists: false } },
        { branch: null }
      ]
    };
    
    const branchUpdate = { 
      $set: { 
        branch: branchId,
        branchName: branchName 
      }
    };
    
    // 2. Update all beneficiaries without a branch
    const beneficiariesResult = await Beneficiary.updateMany(branchFilter, branchUpdate);
    
    // 3. Update all initiatives without a branch
    const initiativesResult = await Initiative.updateMany(branchFilter, branchUpdate);
    
    // 4. Update all treasury transactions without a branch
    const treasuryResult = await TreasuryTransaction.updateMany(branchFilter, branchUpdate);
    
    // 5. Update all warehouse movements without a branch
    const warehouseResult = await WarehouseMovement.updateMany(branchFilter, branchUpdate);
    
    // 6. Update all loans without a branch
    const loansResult = await Loan.updateMany(branchFilter, branchUpdate);
    
    // 7. Update all loan capitals without a branch
    const loanCapitalResult = await LoanCapital.updateMany(branchFilter, branchUpdate);
    
    // 8. Update all donors without a branch
    const donorsResult = await Donor.updateMany(branchFilter, branchUpdate);
    
    // 9. Update all users (except superadmin) without a branch
    const usersResult = await User.updateMany(
      { 
        role: { $ne: 'superadmin' },
        ...branchFilter
      },
      branchUpdate
    );
    
    // Get counts for verification
    const counts = {
      beneficiaries: {
        updated: beneficiariesResult.modifiedCount,
        total: await Beneficiary.countDocuments({}),
        withBranch: await Beneficiary.countDocuments({ branch: branchId })
      },
      initiatives: {
        updated: initiativesResult.modifiedCount,
        total: await Initiative.countDocuments({}),
        withBranch: await Initiative.countDocuments({ branch: branchId })
      },
      treasury: {
        updated: treasuryResult.modifiedCount,
        total: await TreasuryTransaction.countDocuments({}),
        withBranch: await TreasuryTransaction.countDocuments({ branch: branchId })
      },
      warehouse: {
        updated: warehouseResult.modifiedCount,
        total: await WarehouseMovement.countDocuments({}),
        withBranch: await WarehouseMovement.countDocuments({ branch: branchId })
      },
      loans: {
        updated: loansResult.modifiedCount,
        total: await Loan.countDocuments({}),
        withBranch: await Loan.countDocuments({ branch: branchId })
      },
      loanCapital: {
        updated: loanCapitalResult.modifiedCount,
        total: await LoanCapital.countDocuments({}),
        withBranch: await LoanCapital.countDocuments({ branch: branchId })
      },
      donors: {
        updated: donorsResult.modifiedCount,
        total: await Donor.countDocuments({}),
        withBranch: await Donor.countDocuments({ branch: branchId })
      },
      users: {
        updated: usersResult.modifiedCount,
        total: await User.countDocuments({}),
        withBranch: await User.countDocuments({ branch: branchId })
      }
    };

    return NextResponse.json({ 
      success: true, 
      message: "تم تعيين جميع البيانات لفرع الزرقا بنجاح",
      branch: {
        id: branchId,
        name: branchName,
        code: 'ZARQA'
      },
      migration: counts
    });
  } catch (error) {
    console.error("Error migrating data:", error);
    return NextResponse.json({ error: "Failed to migrate data", details: String(error) }, { status: 500 });
  }
}
