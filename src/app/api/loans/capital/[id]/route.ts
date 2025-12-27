import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import LoanCapital from "@/lib/models/LoanCapital";
import { NextResponse } from "next/server";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await dbConnect();

    const capital = await LoanCapital.findByIdAndDelete(id);

    if (!capital) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting capital entry:", error);
    return NextResponse.json(
      { error: "Failed to delete entry" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { amount, source, notes, date } = body;

    await dbConnect();

    const capital = await LoanCapital.findById(id);
    if (!capital) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (amount) capital.amount = amount;
    if (source) capital.source = source;
    if (notes) capital.notes = notes;
    if (date) capital.date = date;

    await capital.save();

    return NextResponse.json(capital);
  } catch (error) {
    console.error("Error updating capital entry:", error);
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 }
    );
  }
}
