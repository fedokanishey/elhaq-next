import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";

// Fix indexes: Remove old unique nationalId index and allow compound index
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
    
    // Try to drop the old nationalId_1 unique index
    let dropResult = null;
    try {
      dropResult = await collection.dropIndex("nationalId_1");
    } catch (e: any) {
      if (e.code === 27) {
        dropResult = "Index nationalId_1 does not exist (already removed)";
      } else {
        dropResult = `Error dropping index: ${e.message}`;
      }
    }
    
    // Get indexes after
    const indexesAfter = await collection.indexes();
    
    return NextResponse.json({ 
      success: true, 
      message: "تم إصلاح الـ indexes بنجاح. الآن كل فرع يمكنه أن يكون له مستفيدين برقم قومي متكرر.",
      dropResult,
      indexesBefore: indexesBefore.map(i => ({ name: i.name, key: i.key, unique: i.unique })),
      indexesAfter: indexesAfter.map(i => ({ name: i.name, key: i.key, unique: i.unique })),
    });
  } catch (error) {
    console.error("Error fixing indexes:", error);
    return NextResponse.json({ error: "Failed to fix indexes", details: String(error) }, { status: 500 });
  }
}
