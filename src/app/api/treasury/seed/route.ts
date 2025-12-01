import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Check if data already exists
    const existingTransactions = await TreasuryTransaction.countDocuments({});
    
    if (existingTransactions > 0) {
      return NextResponse.json({ 
        message: "Treasury data already exists",
        count: existingTransactions 
      });
    }

    // Create sample transactions
    const sampleTransactions = [
      {
        type: "income",
        amount: 50000,
        description: "تبرع من جهة خيرية",
        category: "donations",
        transactionDate: new Date("2025-01-01"),
        createdBy: userId,
      },
      {
        type: "income",
        amount: 75000,
        description: "جمع من حملة خيرية",
        category: "fundraising",
        transactionDate: new Date("2025-01-15"),
        createdBy: userId,
      },
      {
        type: "expense",
        amount: 30000,
        description: "مساعدات اجتماعية",
        category: "social_aid",
        reference: "Initiative-001",
        transactionDate: new Date("2025-02-01"),
        createdBy: userId,
      },
      {
        type: "expense",
        amount: 20000,
        description: "برامج تدريبية",
        category: "training",
        reference: "Initiative-002",
        transactionDate: new Date("2025-02-10"),
        createdBy: userId,
      },
    ];

    const created = await TreasuryTransaction.insertMany(sampleTransactions);

    return NextResponse.json({
      message: "Sample data created successfully",
      count: created.length,
      transactions: created,
    });
  } catch (error) {
    console.error("Error seeding treasury data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
