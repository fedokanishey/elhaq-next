import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await dbConnect();

    // Get all beneficiaries (paginated)
    const skip = 0;
    const limit = 50;

    const beneficiaries = await Beneficiary.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Beneficiary.countDocuments();

    return NextResponse.json({
      beneficiaries,
      total,
      page: 1,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching beneficiaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch beneficiaries" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    // You can add role check here if needed

    await dbConnect();

    const body = await req.json();

    const beneficiary = new Beneficiary({
      clerkId: userId,
      ...body,
    });

    await beneficiary.save();

    return NextResponse.json(beneficiary, { status: 201 });
  } catch (error) {
    console.error("Error creating beneficiary:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create beneficiary" },
      { status: 500 }
    );
  }
}
