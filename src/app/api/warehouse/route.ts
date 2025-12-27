import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import WarehouseMovement from "@/lib/models/WarehouseMovement";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    // if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const query: any = { deletedAt: null };

    if (type) {
      query.type = type;
    }

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const movements = await WarehouseMovement.find(query).sort({ date: -1 }).lean();

    // --- Aggregation Stats ---
    
    // 1. Calculate Product Inventory
    const inventoryAgg = await WarehouseMovement.aggregate([
      { $match: { category: "product", deletedAt: null } },
      { 
        $group: { 
          _id: { itemName: "$itemName", type: "$type" }, 
          totalQuantity: { $sum: "$quantity" } 
        } 
      },
    ]);

    const inventoryMap: Record<string, number> = {};
    inventoryAgg.forEach(item => {
      const name = item._id.itemName;
      const qty = item.totalQuantity;
      if (!item._id.itemName) return;

      if (!inventoryMap[name]) inventoryMap[name] = 0;
      if (item._id.type === "inbound") inventoryMap[name] += qty;
      else inventoryMap[name] -= qty;
    });

    const productInventory = Object.entries(inventoryMap)
      .map(([name, qty]) => ({ itemName: name, quantity: qty }))
      .filter(item => item.quantity > 0);

    // 2. Calculate Cash Balance
    const cashAgg = await WarehouseMovement.aggregate([
      { $match: { category: "cash", deletedAt: null } },
      { 
        $group: { 
          _id: "$type", 
          totalValue: { $sum: "$value" } 
        } 
      },
    ]);
    
    let cashInbound = 0;
    let cashOutbound = 0;
    cashAgg.forEach(item => {
      if (item._id === "inbound") cashInbound = item.totalValue;
      if (item._id === "outbound") cashOutbound = item.totalValue;
    });
    const cashBalance = cashInbound - cashOutbound;

    return NextResponse.json({ 
      movements,
      stats: {
        productInventory,
        cashBalance
      }
    });
  } catch (error) {
    console.error("Error fetching warehouse movements:", error);
    return NextResponse.json(
      { error: "Failed to fetch movements" },
      { status: 500 }
    );
  }
}

// Helper to normalize Arabic text (remove variations of Alef, etc.)
function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .replace(/[أإآ]/g, "ا") // Normalize Alef
    .replace(/ة/g, "ه") // Normalize Teh Marbuta
    .replace(/ى/g, "ي") // Normalize Alef Maqsura
    .trim();
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    let { type, category, itemName, description, quantity, value, date } = body;

    // Validate request
    if (!type || !category || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Require itemName for products
    if (category === 'product' && !itemName) {
      return NextResponse.json({ error: "Item name is required for products" }, { status: 400 });
    }

    // Normalize item name for consistency
    if (itemName) {
      itemName = normalizeArabic(itemName);
    }

    await dbConnect();

    // Check stock for outbound products
    if (type === 'outbound' && category === 'product') {
       if (!quantity || quantity <= 0) {
         return NextResponse.json({ error: "Quantity is required" }, { status: 400 });
       }

       // Calculate current stock using normalized name
       const inboundResult = await WarehouseMovement.aggregate([
         { $match: { itemName, category: 'product', type: 'inbound', deletedAt: null } },
         { $group: { _id: null, total: { $sum: "$quantity" } } }
       ]);
       const totalInbound = inboundResult[0]?.total || 0;

       const outboundResult = await WarehouseMovement.aggregate([
         { $match: { itemName, category: 'product', type: 'outbound', deletedAt: null } },
         { $group: { _id: null, total: { $sum: "$quantity" } } }
       ]);
       const totalOutbound = outboundResult[0]?.total || 0;

       const currentStock = totalInbound - totalOutbound;

       if (quantity > currentStock) {
         return NextResponse.json(
           { error: `الرصيد الحالي (${currentStock}) غير كافي لإتمام العملية` },
           { status: 400 }
         );
       }
    }

    const movement = await WarehouseMovement.create({
      type,
      category,
      itemName,
      description,
      quantity,
      value,
      date: date || new Date(),
      recordedBy: userId,
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error("Error creating warehouse movement:", error);
    return NextResponse.json(
      { error: "Failed to create movement" },
      { status: 500 }
    );
  }
}
