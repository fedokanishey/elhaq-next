import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Update all beneficiaries that don't have a category field
    const result = await Beneficiary.updateMany(
      { category: { $exists: false } },
      { $set: { category: "C" } }
    );

    console.log(`✅ Updated ${result.modifiedCount} beneficiaries with default category 'C'`);

    return NextResponse.json({
      success: true,
      updated: result.modifiedCount,
      message: `تم تحديث ${result.modifiedCount} مستفيد بالفئة الافتراضية C`,
    });
  } catch (error) {
    console.error("❌ Error migrating categories:", error);
    return NextResponse.json(
      { error: "Failed to migrate categories" },
      { status: 500 }
    );
  }
}
