import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Initiative from "@/lib/models/Initiative";
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
    const initiative = await Initiative.findById(id);

    if (!initiative) {
      return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
    }

    return NextResponse.json(initiative);
  } catch (error) {
    console.error("Error fetching initiative:", error);
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

    const initiative = await Initiative.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!initiative) {
      return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
    }

    return NextResponse.json(initiative);
  } catch (error) {
    console.error("Error updating initiative:", error);
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
    const initiative = await Initiative.findByIdAndDelete(id);

    if (!initiative) {
      return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Initiative deleted successfully" });
  } catch (error) {
    console.error("Error deleting initiative:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
