import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Product from "@/lib/models/Product";
import ProductOperation from "@/lib/models/ProductOperation";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string; operationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, operationId } = await context.params;

    // Get the operation
    const operation = await ProductOperation.findOne({ 
      _id: operationId, 
      product: id, 
      deletedAt: null 
    });
    
    if (!operation) {
      return NextResponse.json({ error: "العملية غير موجودة" }, { status: 404 });
    }

    // Get the product
    const product = await Product.findOne({ _id: id, deletedAt: null });
    if (!product) {
      return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
    }

    // Reverse the operation's effect on the product
    const updateData: any = { $inc: {} };
    
    switch (operation.type) {
      case "purchase":
        // Reverse: subtract quantity and cost
        updateData.$inc = {
          currentQuantity: -(operation.quantity || 0),
          totalCost: -(operation.amount || 0),
        };
        break;

      case "expense":
        // Reverse: subtract cost
        updateData.$inc = {
          totalCost: -(operation.amount || 0),
        };
        break;

      case "sale":
        // Reverse: add quantity back, subtract revenue
        updateData.$inc = {
          currentQuantity: operation.quantity || 0,
          totalRevenue: -(operation.amount || 0),
        };
        break;

      case "donation":
        // Reverse: add quantity back
        updateData.$inc = {
          currentQuantity: operation.quantity || 0,
        };
        break;

      case "transform":
        // Reverse: add quantity back
        updateData.$inc = {
          currentQuantity: operation.quantity || 0,
        };
        break;
    }

    // Apply the reverse update
    await Product.findByIdAndUpdate(id, updateData);

    // Soft delete the operation
    await ProductOperation.findByIdAndUpdate(operationId, { 
      deletedAt: new Date() 
    });

    // Refetch updated product
    const updatedProduct = await Product.findById(id).lean();

    return NextResponse.json({ 
      success: true, 
      product: updatedProduct 
    });
  } catch (error) {
    console.error("Error deleting operation:", error);
    return NextResponse.json(
      { error: "Failed to delete operation" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string; operationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, operationId } = await context.params;
    const body = await req.json();
    const { description, quantity, amount, date } = body;

    // Get the old operation
    const oldOperation = await ProductOperation.findOne({ 
      _id: operationId, 
      product: id, 
      deletedAt: null 
    });
    
    if (!oldOperation) {
      return NextResponse.json({ error: "العملية غير موجودة" }, { status: 404 });
    }

    // Get the product
    const product = await Product.findOne({ _id: id, deletedAt: null });
    if (!product) {
      return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
    }

    // Calculate the difference
    const quantityDiff = (quantity || 0) - (oldOperation.quantity || 0);
    const amountDiff = (amount || 0) - (oldOperation.amount || 0);

    // Update product totals based on the difference
    const updateData: any = { $inc: {} };
    
    switch (oldOperation.type) {
      case "purchase":
        updateData.$inc = {
          currentQuantity: quantityDiff,
          totalCost: amountDiff,
        };
        break;

      case "expense":
        updateData.$inc = {
          totalCost: amountDiff,
        };
        break;

      case "sale":
        // Validate new quantity
        const newQuantityNeeded = product.currentQuantity + oldOperation.quantity - (quantity || 0);
        if (newQuantityNeeded < 0) {
          return NextResponse.json(
            { error: "الكمية الجديدة ستجعل رصيد المنتج سالب" },
            { status: 400 }
          );
        }
        updateData.$inc = {
          currentQuantity: -quantityDiff,
          totalRevenue: amountDiff,
        };
        break;

      case "donation":
        const newQtyAfterDonation = product.currentQuantity + oldOperation.quantity - (quantity || 0);
        if (newQtyAfterDonation < 0) {
          return NextResponse.json(
            { error: "الكمية الجديدة ستجعل رصيد المنتج سالب" },
            { status: 400 }
          );
        }
        updateData.$inc = {
          currentQuantity: -quantityDiff,
        };
        break;

      case "transform":
        updateData.$inc = {
          currentQuantity: -quantityDiff,
        };
        break;
    }

    // Apply the update to product
    await Product.findByIdAndUpdate(id, updateData);

    // Update the operation
    const updatedOperation = await ProductOperation.findByIdAndUpdate(
      operationId,
      {
        description: description || oldOperation.description,
        quantity: quantity !== undefined ? quantity : oldOperation.quantity,
        amount: amount !== undefined ? amount : oldOperation.amount,
        date: date || oldOperation.date,
      },
      { new: true }
    );

    // Refetch updated product
    const updatedProduct = await Product.findById(id).lean();

    return NextResponse.json({ 
      operation: updatedOperation, 
      product: updatedProduct 
    });
  } catch (error) {
    console.error("Error updating operation:", error);
    return NextResponse.json(
      { error: "Failed to update operation" },
      { status: 500 }
    );
  }
}
