import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Initiative from "@/lib/models/Initiative";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

export async function POST(
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

    const { barcode } = await req.json();
    const barcodeValue = barcode?.trim();

    if (!barcodeValue) {
      return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 });
    }

    const initiative = await Initiative.findById(id);
    if (!initiative) {
      return NextResponse.json({ error: "المبادرة غير موجودة" }, { status: 404 });
    }

    // Build candidates for matching (handling padding and prefixes)
    const candidates = [barcodeValue, barcodeValue.toUpperCase(), barcodeValue.toLowerCase()];
    
    if (/^\d+$/.test(barcodeValue)) {
      // Standard lengths to pad: 2, 3, 4, 5, 6, 7, 8
      for (const len of [2, 3, 4, 5, 6, 7, 8]) {
        const padded = barcodeValue.padStart(len, "0");
        candidates.push(padded);
        candidates.push(`dhz${padded}`);
        candidates.push(`DHZ${padded}`);
      }
    } else {
      // If it has dhz prefix, also extract the numeric part and add numeric candidates
      const lower = barcodeValue.toLowerCase();
      if (lower.startsWith("dhz")) {
        const withoutPrefix = lower.slice(3);
        const numericStr = withoutPrefix.replace(/^0+/, "");
        if (/^\d+$/.test(numericStr)) {
          candidates.push(numericStr);
          for (const len of [2, 3, 4, 5, 6, 7, 8]) {
            const padded = numericStr.padStart(len, "0");
            candidates.push(padded);
            candidates.push(`dhz${padded}`);
            candidates.push(`DHZ${padded}`);
          }
        }
      }
    }

    const uniqueCandidates = Array.from(new Set(candidates));

    // Build the query to find the beneficiary within this initiative's target beneficiaries list
    const filter: any = {
      _id: { $in: initiative.beneficiaries },
    };

    const orConditions: any[] = [
      { internalId: { $in: uniqueCandidates } },
      { nationalId: { $in: uniqueCandidates } },
    ];

    if (isValidObjectId(barcodeValue)) {
      orConditions.push({ _id: barcodeValue });
    }

    filter.$or = orConditions;

    const beneficiary = await Beneficiary.findOne(filter);
    if (!beneficiary) {
      return NextResponse.json(
        { error: "المستفيد غير مسجل في هذه المبادرة أو رقم الباركود غير صحيح" },
        { status: 404 }
      );
    }

    // Add beneficiary to the beneficiariesReceived array
    await Initiative.findByIdAndUpdate(
      id,
      { $addToSet: { beneficiariesReceived: beneficiary._id } },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      beneficiaryName: beneficiary.name,
      beneficiaryId: beneficiary._id.toString(),
    });
  } catch (error) {
    console.error("Error toggling beneficiary benefit status via scan:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
