import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import MarriageCase from "@/lib/models/MarriageCase";
import Beneficiary from "@/lib/models/Beneficiary";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const marriageCase = await MarriageCase.findById(id)
      .populate("beneficiary", "name internalId phone nationalId address category")
      .lean();

    if (!marriageCase) {
      return NextResponse.json({ error: "الحالة غير موجودة" }, { status: 404 });
    }

    return NextResponse.json({ case: marriageCase });
  } catch (error) {
    console.error("Error fetching marriage case:", error);
    return NextResponse.json({ error: "فشل جلب تفاصيل الحالة" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized || (!authResult.isAdmin && !authResult.isMember)) {
      return NextResponse.json({ error: "غير مصرح لك بالتعديل" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const existingCase = await MarriageCase.findById(id);
    if (!existingCase) {
      return NextResponse.json({ error: "الحالة غير موجودة" }, { status: 404 });
    }

    const updateData: any = {};

    if (body.personName !== undefined) updateData.personName = String(body.personName).trim();
    if (body.relationship !== undefined) updateData.relationship = body.relationship;
    if (body.nationalId !== undefined) updateData.nationalId = String(body.nationalId).trim();
    if (body.phone !== undefined) updateData.phone = String(body.phone).trim();
    if (body.spouseName !== undefined) updateData.spouseName = String(body.spouseName).trim();
    if (body.notes !== undefined) updateData.notes = String(body.notes).trim();
    if (body.certificateImage !== undefined) updateData.certificateImage = String(body.certificateImage).trim();
    
    if (body.marriageDate !== undefined) {
      updateData.marriageDate = body.marriageDate ? new Date(body.marriageDate) : null;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "completed" && existingCase.status !== "completed") {
        updateData.completedAt = new Date();
      } else if (body.status !== "completed") {
        updateData.completedAt = null;
      }
    }

    if (body.itemsProvided !== undefined) {
      updateData.itemsProvided = (body.itemsProvided || []).map((item: any) => ({
        itemName: String(item.itemName || "").trim(),
        quantity: Number(item.quantity || 1),
        cost: Number(item.cost || 0),
        notes: item.notes ? String(item.notes).trim() : "",
        deliveredAt: item.deliveredAt ? new Date(item.deliveredAt) : undefined,
      }));
    }

    if (body.cashAssistance !== undefined) {
      updateData.cashAssistance = Number(body.cashAssistance || 0);
    }

    // Recalculate total cost if items or cash assistance changed
    const currentItems = updateData.itemsProvided ?? existingCase.itemsProvided ?? [];
    const currentCash = updateData.cashAssistance ?? existingCase.cashAssistance ?? 0;
    
    const itemsTotal = currentItems.reduce(
      (sum: number, item: any) => sum + (Number(item.cost || 0) * Number(item.quantity || 1)),
      0
    );
    updateData.totalCost = itemsTotal + currentCash;

    const updated = await MarriageCase.findByIdAndUpdate(id, updateData, { new: true })
      .populate("beneficiary", "name internalId phone nationalId address category")
      .lean();

    return NextResponse.json({ success: true, case: updated });
  } catch (error) {
    console.error("Error updating marriage case:", error);
    return NextResponse.json({ error: "فشل تحديث بيانات الحالة" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized || (!authResult.isAdmin && !authResult.isMember)) {
      return NextResponse.json({ error: "غير مصرح لك بالحذف" }, { status: 403 });
    }

    const { id } = await params;
    const deletedCase = await MarriageCase.findByIdAndDelete(id);
    if (!deletedCase) {
      return NextResponse.json({ error: "الحالة غير موجودة" }, { status: 404 });
    }

    // Check if beneficiary still has any marriage cases left
    const remainingCases = await MarriageCase.countDocuments({
      beneficiary: deletedCase.beneficiary,
    });
    if (remainingCases === 0) {
      await Beneficiary.findByIdAndUpdate(deletedCase.beneficiary, {
        acceptsMarriage: false,
      });
    }

    return NextResponse.json({ success: true, message: "تم حذف الحالة بنجاح" });
  } catch (error) {
    console.error("Error deleting marriage case:", error);
    return NextResponse.json({ error: "فشل حذف الحالة" }, { status: 500 });
  }
}

