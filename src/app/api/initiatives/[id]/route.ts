import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Initiative from "@/lib/models/Initiative";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid initiative id" }, { status: 400 });
    }
    const initiative = await Initiative.findById(id).lean();

    if (!initiative) {
      return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
    }

    let hydratedBeneficiaries = [] as Array<{
      _id: string;
      name: string;
      phone?: string;
      profileImage?: string;
    }>;

    if (Array.isArray(initiative.beneficiaries) && initiative.beneficiaries.length > 0) {
      const beneficiaryIds = initiative.beneficiaries
        .map((value: any) => {
          if (!value) return null;
          let raw: string;
          if (typeof value === "string") {
            raw = value;
          } else if (typeof value === "object" && value !== null) {
            // If the value is an object, try to extract an _id or use its string representation
            raw = (value as any)?._id?.toString?.() ?? String(value);
          } else {
            raw = String(value);
          }
          return isValidObjectId(raw) ? raw : null;
        })
        .filter((value): value is string => Boolean(value));

      if (beneficiaryIds.length > 0) {
        const raw = await Beneficiary.find({ _id: { $in: beneficiaryIds } })
          .select("name phone profileImage")
          .lean();

        // Ensure _id is a string for the API response
        hydratedBeneficiaries = raw.map((b: any) => ({
          _id: b._id?.toString?.() ?? b._id,
          name: b.name || "",
          phone: b.phone,
          profileImage: b.profileImage,
        }));
      }
    }

    const serializedInitiative = {
      ...initiative,
      _id: initiative._id?.toString?.() ?? initiative._id,
      beneficiaries: hydratedBeneficiaries,
    };

    return NextResponse.json(serializedInitiative);
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

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid initiative id" }, { status: 400 });
    }
    const body = await req.json();
    const update: Record<string, unknown> = { ...body };

    if (Object.prototype.hasOwnProperty.call(body, "beneficiaries")) {
      update.beneficiaries = Array.isArray(body.beneficiaries)
        ? body.beneficiaries
        : [];
    }

    if (Object.prototype.hasOwnProperty.call(body, "images")) {
      update.images = Array.isArray(body.images) ? body.images : [];
    }

    const initiative = await Initiative.findByIdAndUpdate(id, update, {
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

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid initiative id" }, { status: 400 });
    }
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
