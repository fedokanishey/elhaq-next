import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";

// Fix indexes: Remove old unique indexes and allow compound indexes with branch
export async function GET() {
  try {
    await dbConnect();
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: "Database not connected" }, { status: 500 });
    }
    
    const collection = db.collection("beneficiaries");
    
    // Get current indexes
    const indexesBefore = await collection.indexes();
    
    const dropResults: Record<string, string> = {};

    // Drop old nationalId_1 unique index
    try {
      await collection.dropIndex("nationalId_1");
      dropResults.nationalId_1 = "Dropped successfully";
    } catch (e: any) {
      dropResults.nationalId_1 = e.code === 27
        ? "Does not exist (already removed)"
        : `Error: ${e.message}`;
    }

    // Drop old internalId_1 unique index
    try {
      await collection.dropIndex("internalId_1");
      dropResults.internalId_1 = "Dropped successfully";
    } catch (e: any) {
      dropResults.internalId_1 = e.code === 27
        ? "Does not exist (already removed)"
        : `Error: ${e.message}`;
    }
    
    // Get indexes after
    const indexesAfter = await collection.indexes();
    
    return NextResponse.json({ 
      success: true, 
      message: "تم إصلاح الـ indexes. الآن كل فرع يمكنه أن يكون له مستفيدين بنفس الرقم القومي أو رقم المستفيد الداخلي.",
      dropResults,
      indexesBefore: indexesBefore.map(i => ({ name: i.name, key: i.key, unique: i.unique })),
      indexesAfter: indexesAfter.map(i => ({ name: i.name, key: i.key, unique: i.unique })),
    });
  } catch (error) {
    console.error("Error fixing indexes:", error);
    return NextResponse.json({ error: "Failed to fix indexes", details: String(error) }, { status: 500 });
  }
}

