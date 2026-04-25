import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Notification from "@/lib/models/Notification";
import {
  getAuthenticatedUser,
  getBranchFilterWithOverride,
} from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
    }

    await dbConnect();

    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    const body = await req.json();
    const isRead = body?.isRead !== undefined ? Boolean(body.isRead) : true;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        ...branchFilter,
      },
      {
        $set: { isRead },
      },
      { new: true }
    ).lean();

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
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

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
    }

    await dbConnect();

    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    const deleted = await Notification.findOneAndDelete({
      _id: id,
      ...branchFilter,
    }).lean();

    if (!deleted) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}
