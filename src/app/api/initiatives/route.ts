import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Initiative from "@/lib/models/Initiative";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await dbConnect();
    const initiatives = await Initiative.find().sort({ date: -1 });
    return NextResponse.json({ initiatives });
  } catch (error) {
    console.error("Error fetching initiatives:", error);
    return NextResponse.json(
      { error: "Failed to fetch initiatives" },
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

    await dbConnect();
    const body = await req.json();
    
    const initiative = new Initiative(body);
    await initiative.save();

    return NextResponse.json(initiative, { status: 201 });
  } catch (error) {
    console.error("Error creating initiative:", error);
    return NextResponse.json(
      { error: "Failed to create initiative" },
      { status: 500 }
    );
  }
}
