import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import WarehouseMovement from "@/lib/models/WarehouseMovement";
import { NextResponse } from "next/server";

// Helper to normalize Arabic text (duplicate from main route til shared lib)
function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    let { type, category, itemName, description, quantity, value, date } = body;

    await dbConnect();

    const existingMovement = await WarehouseMovement.findById(id);
    if (!existingMovement) {
      return NextResponse.json({ error: "Movement not found" }, { status: 404 });
    }

    if (category === 'product') {
       if (!itemName) return NextResponse.json({ error: "Item name is required" }, { status: 400 });
       itemName = normalizeArabic(itemName);
    }

    // Stock Validation for Outbound Product updates
    if (type === 'outbound' && category === 'product') {
       const newQuantity = Number(quantity);
       
       // Calculate current stock (excluding the movement being edited)
       const inboundResult = await WarehouseMovement.aggregate([
         { $match: { itemName, category: 'product', type: 'inbound', deletedAt: null } },
         { $group: { _id: null, total: { $sum: "$quantity" } } }
       ]);
       const totalInbound = inboundResult[0]?.total || 0;

       const outboundResult = await WarehouseMovement.aggregate([
         { $match: { itemName, category: 'product', type: 'outbound', deletedAt: null, _id: { $ne: existingMovement._id } } },
         { $group: { _id: null, total: { $sum: "$quantity" } } }
       ]);
       const totalOutbound = outboundResult[0]?.total || 0;

       const currentStock = totalInbound - totalOutbound;

       if (newQuantity > currentStock) {
         return NextResponse.json(
           { error: `الرصيد المتاح (${currentStock}) غير كافي` },
           { status: 400 }
         );
       }
    }

    existingMovement.type = type;
    existingMovement.category = category;
    existingMovement.itemName = itemName;
    existingMovement.description = description;
    existingMovement.quantity = quantity;
    existingMovement.value = value;
    if (date) existingMovement.date = date; // Allow updating date if provided

    await existingMovement.save();

    return NextResponse.json(existingMovement);
  } catch (error) {
    console.error("Error updating movement:", error);
    return NextResponse.json(
      { error: "Failed to update movement" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    // Check for admin role if needed
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await dbConnect();

    const movement = await WarehouseMovement.findById(id);
    if (!movement) {
      return NextResponse.json({ error: "Movement not found" }, { status: 404 });
    }

    // Soft delete
    movement.deletedAt = new Date();
    await movement.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting movement:", error);
    return NextResponse.json(
      { error: "Failed to delete movement" },
      { status: 500 }
    );
  }
}
