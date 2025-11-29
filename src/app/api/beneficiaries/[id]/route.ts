import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import Initiative from "@/lib/models/Initiative";
import { NextResponse } from "next/server";
import { sanitizeBeneficiaryPayload } from "@/lib/beneficiaries/sanitizePayload";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const beneficiary = await Beneficiary.findById(id);

    if (!beneficiary) {
      return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
    }

    const initiatives = await Initiative.find({ beneficiaries: id })
      .sort({ date: -1 })
      .select("name status date totalAmount")
      .lean();

    return NextResponse.json({ beneficiary, initiatives });
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
    const rawBody = await req.json();
    const payload = sanitizeBeneficiaryPayload(rawBody);

    const beneficiary = await Beneficiary.findById(id);

    if (!beneficiary) {
      return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
    }

    const { children, spouse, ...rest } = payload;

    beneficiary.set(rest);
    beneficiary.children = children;
    beneficiary.spouse = spouse;
    beneficiary.markModified("children");
    beneficiary.markModified("spouse");
    await beneficiary.save();

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
