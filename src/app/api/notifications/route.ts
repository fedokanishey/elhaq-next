import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Notification, {
  NOTIFICATION_ACTION_TYPES,
  NotificationActionType,
} from "@/lib/models/Notification";
import {
  getAuthenticatedUser,
  getBranchFilterWithOverride,
} from "@/lib/auth-helpers";
import { createActivityNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 100))
      : 25;
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const branchIdOverride = searchParams.get("branchId");

    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);
    const query: Record<string, unknown> = { ...branchFilter };

    if (unreadOnly) {
      query.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ ...branchFilter, isRead: false }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const actionType = body.actionType as NotificationActionType;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!NOTIFICATION_ACTION_TYPES.includes(actionType)) {
      return NextResponse.json(
        { error: "Invalid notification action type" },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const notification = await createActivityNotification({
      authResult,
      actionType,
      message,
      actorName: typeof body.actorName === "string" ? body.actorName : undefined,
      entityId: typeof body.entityId === "string" ? body.entityId : undefined,
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : undefined,
      branch: body.branch,
      branchName: body.branchName,
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    const result = await Notification.updateMany(
      { ...branchFilter, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({
      success: true,
      markedAsRead: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
