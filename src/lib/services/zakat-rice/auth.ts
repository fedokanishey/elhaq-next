import { auth } from "@clerk/nextjs/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import dbConnect from "@/lib/mongodb";
import { ZkUserRole } from "@/lib/models/zakat-rice";

export type ZkRole = "admin" | "store" | "dist" | "acct" | "viewer";

export interface ZkAuthContext {
  userId: string;
  name: string;
  role: ZkRole;
  isAdmin: boolean;
  canStore: boolean;
  canDistribute: boolean;
  canAccount: boolean;
  canDelete: boolean;
  isAuthenticated: boolean;
}

export async function getZkAuth(): Promise<ZkAuthContext> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        userId: "anonymous",
        name: "زائر",
        role: "viewer",
        isAdmin: false,
        canStore: false,
        canDistribute: false,
        canAccount: false,
        canDelete: false,
        isAuthenticated: false,
      };
    }

    const mainAuth = await getAuthenticatedUser();
    let name = "مستخدم";
    if (mainAuth.user) {
      name = `${mainAuth.user.firstName || ""} ${mainAuth.user.lastName || ""}`.trim() || mainAuth.user.email || "مستخدم";
    }

    // Default: if admin or superadmin in main site, they are zk admin
    let role: ZkRole = (mainAuth.isAdmin || mainAuth.isSuperAdmin) ? "admin" : "viewer";

    // Check specific role in zk_user_roles if exists
    await dbConnect();
    const zkUser = await ZkUserRole.findOne({ user_id: userId });
    if (zkUser) {
      role = zkUser.role;
    } else if (mainAuth.isMember) {
      role = "viewer"; // Member role is strictly read-only (viewer)
    }

    const isAdmin = (role === "admin" || mainAuth.isAdmin || mainAuth.isSuperAdmin) && !mainAuth.isMember;
    const canStore = isAdmin || (role === "store" && !mainAuth.isMember);
    const canDistribute = isAdmin || (role === "dist" && !mainAuth.isMember);
    const canAccount = isAdmin || ((role === "acct" || role === "store") && !mainAuth.isMember);
    const canDelete = isAdmin;

    return {
      userId,
      name,
      role,
      isAdmin,
      canStore,
      canDistribute,
      canAccount,
      canDelete,
      isAuthenticated: true,
    };
  } catch (err) {
    return {
      userId: "system",
      name: "النظام",
      role: "admin",
      isAdmin: true,
      canStore: true,
      canDistribute: true,
      canAccount: true,
      canDelete: true,
      isAuthenticated: true,
    };
  }
}

