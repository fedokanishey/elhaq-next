import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Initiative from "@/lib/models/Initiative";
import Beneficiary from "@/lib/models/Beneficiary";
import User from "@/lib/models/User";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import Loan from "@/lib/models/Loan";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Get authenticated user with branch info
    const authResult = await getAuthenticatedUser();
    
    // Check if authorized
    if (!authResult.isAuthorized && !authResult.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get branchId from query params (for SuperAdmin branch filtering)
    const { searchParams } = new URL(request.url);
    const branchIdOverride = searchParams.get("branchId");
    
    // Build branch filter based on user role and optional override
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    // Sync admin user if not exists (Robust Logic)
    const userEmail = (sessionClaims?.email as string) || (await currentUser())?.emailAddresses[0]?.emailAddress;
    let clerkUser = null;

    if (userEmail) {
        if (!clerkUser) clerkUser = await currentUser();
        if (clerkUser) {
          await User.findOneAndUpdate(
            { $or: [{ clerkId: userId }, { email: userEmail }] },
            {
              $set: {
                clerkId: userId,
                email: userEmail,
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                profileImageUrl: clerkUser.imageUrl,
              },
              $setOnInsert: { role: 'admin' }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
    }

    // Apply branch filter to all queries
    const initiatives = await Initiative.find(branchFilter);
    const beneficiaries = await Beneficiary.find(branchFilter);
    
    // Users count - SuperAdmin sees all (or filtered branch), Admin sees users in their branch
    const userBranchFilter = (authResult.isSuperAdmin && branchIdOverride) 
      ? { branch: branchIdOverride }
      : (authResult.isSuperAdmin ? {} : branchFilter);
    const usersCount = await User.countDocuments(userBranchFilter);

    console.log(`[Reports API] Branch: ${branchIdOverride || authResult.branchName || 'All'}, Initiatives: ${initiatives.length}, Beneficiaries: ${beneficiaries.length}`);

    const totalInitiatives = initiatives.length;
    const totalBeneficiaries = beneficiaries.length;
    
    // Calculate total amount spent on initiatives
    const totalAmountSpent = initiatives.reduce((sum, init) => sum + (init.totalAmount || 0), 0);

    // Calculate remaining balance (total received - total spent) - filtered by branch
    const incomeTransactions = await TreasuryTransaction.find({ type: 'income', ...branchFilter });
    const expenseTransactions = await TreasuryTransaction.find({ type: 'expense', ...branchFilter });
    
    console.log(`[Reports API] Income Transactions: ${incomeTransactions.length}, Expense: ${expenseTransactions.length}`);
    
    const totalReceived = incomeTransactions.reduce((sum: number, transaction: any) => sum + (transaction.amount || 0), 0);
    const totalExpenses = expenseTransactions.reduce((sum: number, transaction: any) => sum + (transaction.amount || 0), 0);
    
    const remainingBalance = totalReceived - totalExpenses;

    // Calculate initiatives by status
    const initiativesByStatus = {
      planned: initiatives.filter(i => i.status === 'planned').length,
      active: initiatives.filter(i => i.status === 'active').length,
      completed: initiatives.filter(i => i.status === 'completed').length,
      cancelled: initiatives.filter(i => i.status === 'cancelled').length,
    };

    // --- Loan Stats --- (filtered by branch)
    const loanBranchFilter = { ...branchFilter, deletedAt: null };
    const activeLoansCount = await Loan.countDocuments({ status: "active", ...loanBranchFilter });
    const completedLoansCount = await Loan.countDocuments({ status: "completed", ...loanBranchFilter });
    
    // Aggregating quantities for Loans
    const loanMatchStage = (authResult.isSuperAdmin && !branchIdOverride) 
      ? { deletedAt: null }
      : { deletedAt: null, ...branchFilter };
    
    const loanStats = await Loan.aggregate([
       { $match: loanMatchStage },
       { 
         $group: { 
           _id: null, 
           totalLoaned: { $sum: "$amount" },
           totalPaid: { $sum: "$amountPaid" },
           activeAmount: { 
             $sum: { 
               $cond: [{ $eq: ["$status", "active"] }, { $subtract: ["$amount", "$amountPaid"] }, 0] 
             }
           }
         } 
       }
    ]);
    const totalLoaned = loanStats[0]?.totalLoaned || 0;
    const totalLoanPaid = loanStats[0]?.totalPaid || 0;
    const activeLoanBalance = loanStats[0]?.activeAmount || 0;

    // --- Warehouse Stats --- (using new Products model)
    const productQuery = (authResult.isSuperAdmin && !branchIdOverride) 
      ? { deletedAt: null, status: "active" }
      : { deletedAt: null, status: "active", ...branchFilter };
    
    // Import Product model dynamically to avoid issues if not imported at top
    const Product = (await import("@/lib/models/Product")).default;
    
    const products = await Product.find(productQuery).lean();
    
    // Calculate stats from products (matching warehouse page logic)
    const inventoryItemsCount = products.length;
    const totalCost = products.reduce((sum: number, p: any) => sum + (p.totalCost || 0), 0);
    const totalRevenue = products.reduce((sum: number, p: any) => sum + (p.totalRevenue || 0), 0);
    const netProfit = totalRevenue - totalCost;
    
    console.log(`[Reports API] Products Query:`, JSON.stringify(productQuery));
    console.log(`[Reports API] Products Count:`, products.length, `Total Cost:`, totalCost, `Total Revenue:`, totalRevenue);


    return NextResponse.json({
      stats: {
        totalInitiatives,
        totalBeneficiaries,
        totalAmountSpent,
        initiativesByStatus,
        totalUsers: usersCount,
        remainingBalance,
        // New Stats
        loans: {
            activeCount: activeLoansCount,
            completedCount: completedLoansCount,
            totalLoaned,
            totalPaid: totalLoanPaid,
            activeBalance: activeLoanBalance
        },
        warehouse: {
            itemsCount: inventoryItemsCount,
            cashBalance: netProfit, // صافي الربح = الإيرادات - التكاليف
            totalStockValue: totalCost, // إجمالي تكلفة المخزون
            totalRevenue: totalRevenue, // إجمالي الإيرادات
        }
      },
      branch: authResult.branchName,
      isSuperAdmin: authResult.isSuperAdmin,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
