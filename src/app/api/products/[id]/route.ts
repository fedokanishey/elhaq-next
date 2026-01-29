import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Product from "@/lib/models/Product";
import ProductOperation from "@/lib/models/ProductOperation";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await auth();
    await dbConnect();

    const { id } = await context.params;

    const product = await Product.findOne({ _id: id, deletedAt: null }).lean();
    if (!product) {
      return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
    }

    // Get all operations for this product
    const operations = await ProductOperation.find({
      product: id,
      deletedAt: null,
    })
      .sort({ date: -1 })
      .lean();

    return NextResponse.json({ product, operations });
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const product = await Product.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { 
        name: body.name,
        category: body.category,
        unit: body.unit,
        notes: body.notes,
        status: body.status,
      },
      { new: true }
    );

    if (!product) {
      return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    // Soft delete the product
    const product = await Product.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date(), status: "archived" },
      { new: true }
    );

    if (!product) {
      return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
    }

    // Also soft delete all operations
    await ProductOperation.updateMany(
      { product: id },
      { deletedAt: new Date() }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
