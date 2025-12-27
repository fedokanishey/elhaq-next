import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import LoanCapital from "@/lib/models/LoanCapital";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    // if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    const capitals = await LoanCapital.find({}).sort({ date: -1 }).lean();

    return NextResponse.json({ capitals });
  } catch (error) {
    console.error("Error fetching capital history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { amount, source, notes } = body;

    if (!amount || !source) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await dbConnect();

    const capital = await LoanCapital.create({
      amount,
      source,
      notes,
      recordedBy: userId, // ideally fetch user name
    });

    return NextResponse.json(capital, { status: 201 });
  } catch (error) {
    console.error("Error adding loan capital:", error);
    return NextResponse.json(
      { error: "Failed to add capital" },
      { status: 500 }
    );
  }
}
