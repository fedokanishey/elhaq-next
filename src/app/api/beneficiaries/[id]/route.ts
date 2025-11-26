import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const beneficiary = await Beneficiary.findById(id);

    if (!beneficiary) {
      return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
    }

    return NextResponse.json(beneficiary);
  } catch (error) {
    console.error("Error fetching beneficiary:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const beneficiary = await Beneficiary.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!beneficiary) {
      return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
    }

    return NextResponse.json(beneficiary);
  } catch (error) {
    console.error("Error updating beneficiary:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const beneficiary = await Beneficiary.findByIdAndDelete(id);

    if (!beneficiary) {
      return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Beneficiary deleted successfully" });
  } catch (error) {
    console.error("Error deleting beneficiary:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
