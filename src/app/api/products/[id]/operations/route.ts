import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Product from "@/lib/models/Product";
import ProductOperation from "@/lib/models/ProductOperation";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function POST(
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
    const { type, description, quantity, amount, date, byproductName, byproductQuantity } = body;

    // Validate required fields
    if (!type || !description) {
      return NextResponse.json({ error: "البيانات غير مكتملة" }, { status: 400 });
    }

    // Get the product
    const product = await Product.findOne({ _id: id, deletedAt: null });
    if (!product) {
      return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
    }

    // Determine amount type based on operation type
    let amountType: "cost" | "revenue" = "cost";
    if (type === "sale") {
      amountType = "revenue";
    }

    // Determine target branch
    const targetBranch = authResult.isSuperAdmin ? body.branch : authResult.branch;
    const targetBranchName = authResult.isSuperAdmin ? body.branchName : authResult.branchName;

    // Create the operation
    const operation = await ProductOperation.create({
      product: id,
      type,
      description,
      quantity: quantity || 0,
      amount: amount || 0,
      amountType,
      byproductName,
      byproductQuantity,
      date: date || new Date(),
      recordedBy: userId,
      branch: targetBranch || product.branch,
      branchName: targetBranchName || product.branchName,
    });

    // Update product totals based on operation type
    const updateData: any = {};

    switch (type) {
      case "purchase":
        // Add quantity and cost
        updateData.$inc = {
          currentQuantity: quantity || 0,
          totalCost: amount || 0,
        };
        break;

      case "expense":
        // Add cost only
        updateData.$inc = {
          totalCost: amount || 0,
        };
        break;

      case "sale":
        // Reduce quantity, add revenue
        if (quantity > product.currentQuantity) {
          // Rollback the operation
          await ProductOperation.findByIdAndDelete(operation._id);
          return NextResponse.json(
            { error: `الكمية المتاحة (${product.currentQuantity}) غير كافية` },
            { status: 400 }
          );
        }
        updateData.$inc = {
          currentQuantity: -(quantity || 0),
          totalRevenue: amount || 0,
        };
        break;

      case "donation":
        // Donation - reduce quantity only, no cost impact
        if (quantity > product.currentQuantity) {
          await ProductOperation.findByIdAndDelete(operation._id);
          return NextResponse.json(
            { error: `الكمية المتاحة (${product.currentQuantity}) غير كافية للتبرع` },
            { status: 400 }
          );
        }
        updateData.$inc = {
          currentQuantity: -(quantity || 0),
        };
        break;

      case "transform":
        // This is handled separately - reduces source product quantity
        if (quantity > product.currentQuantity) {
          await ProductOperation.findByIdAndDelete(operation._id);
          return NextResponse.json(
            { error: `الكمية المتاحة (${product.currentQuantity}) غير كافية للتحويل` },
            { status: 400 }
          );
        }
        updateData.$inc = {
          currentQuantity: -(quantity || 0),
        };
        // Mark as depleted if no quantity left
        if (product.currentQuantity - quantity <= 0) {
          updateData.status = "depleted";
        }
        break;
    }

    // Apply the update
    if (Object.keys(updateData).length > 0) {
      await Product.findByIdAndUpdate(id, updateData);
    }

    // Refetch updated product
    const updatedProduct = await Product.findById(id).lean();

    return NextResponse.json({ operation, product: updatedProduct }, { status: 201 });
  } catch (error) {
    console.error("Error creating operation:", error);
    return NextResponse.json(
      { error: "Failed to create operation" },
      { status: 500 }
    );
  }
}
