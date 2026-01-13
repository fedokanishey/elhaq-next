import { auth, currentUser } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import User, { IUser, UserRole } from "@/lib/models/User";
import Branch from "@/lib/models/Branch";
import { Types } from "mongoose";

export interface AuthResult {
  userId: string | null;
  user: IUser | null;
  role: UserRole;
  branch: Types.ObjectId | null;
  branchName: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isAuthorized: boolean; // admin, member, or superadmin
}

/**
 * Get authenticated user with full details including branch
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  const { userId, sessionClaims } = await auth();
  
  const nullResult: AuthResult = {
    userId: null,
    user: null,
    role: 'user',
    branch: null,
    branchName: null,
    isSuperAdmin: false,
    isAdmin: false,
    isMember: false,
    isAuthorized: false,
  };

  if (!userId) {
    return nullResult;
  }

  await dbConnect();

  // Check MongoDB for user
  let dbUser = await User.findOne({ clerkId: userId }).populate('branch');
  
  if (!dbUser) {
    // Try to create user from Clerk data
    const clerkUser = await currentUser();
    if (clerkUser) {
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (email) {
        dbUser = await User.findOneAndUpdate(
          { $or: [{ clerkId: userId }, { email }] },
          {
            clerkId: userId,
            email,
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
            profileImageUrl: clerkUser.imageUrl,
            $setOnInsert: { 
              role: (clerkUser.publicMetadata?.role as UserRole) || 'user' 
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }
  }

  const role = dbUser?.role || 
    (sessionClaims?.metadata as { role?: UserRole })?.role || 
    'user';

  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin';
  const isMember = role === 'member';
  const isAuthorized = isSuperAdmin || isAdmin || isMember;

  return {
    userId,
    user: dbUser,
    role,
    branch: dbUser?.branch || null,
    branchName: dbUser?.branchName || null,
    isSuperAdmin,
    isAdmin,
    isMember,
    isAuthorized,
  };
}

/**
 * Build branch filter for queries
 * SuperAdmin can see all branches, others only see their own branch or data without branch (legacy)
 */
export function getBranchFilter(authResult: AuthResult): Record<string, unknown> {
  if (authResult.isSuperAdmin) {
    return {}; // No filter for superadmin
  }
  
  if (authResult.branch) {
    // User has branch - see their branch data AND legacy data without branch
    return { 
      $or: [
        { branch: authResult.branch },
        { branch: { $exists: false } },
        { branch: null }
      ]
    };
  }
  
  // If user has no branch assigned, show data without branch (legacy data)
  return { 
    $or: [
      { branch: { $exists: false } },
      { branch: null }
    ]
  };
}

/**
 * Build branch filter for queries with optional branchId override for SuperAdmin
 * This allows SuperAdmin to filter by a specific branch
 */
export function getBranchFilterWithOverride(
  authResult: AuthResult, 
  branchIdOverride?: string | null
): Record<string, unknown> {
  // If SuperAdmin and branchId is provided, filter by that specific branch
  if (authResult.isSuperAdmin && branchIdOverride) {
    // Convert string to ObjectId for proper MongoDB query
    try {
      return { branch: new Types.ObjectId(branchIdOverride) };
    } catch {
      // If invalid ObjectId, use string as fallback
      return { branch: branchIdOverride };
    }
  }
  
  // Otherwise use the standard branch filter
  return getBranchFilter(authResult);
}

/**
 * Check if user can manage another user
 * SuperAdmin can manage everyone
 * Admin can manage members and users in same branch
 */
export function canManageUser(
  requester: AuthResult, 
  targetRole: UserRole, 
  targetBranch?: Types.ObjectId
): boolean {
  if (requester.isSuperAdmin) {
    return true;
  }
  
  if (requester.isAdmin) {
    // Admin can't manage superadmin or other admins
    if (targetRole === 'superadmin' || targetRole === 'admin') {
      return false;
    }
    // Admin can only manage users in same branch
    if (targetBranch && requester.branch) {
      return targetBranch.toString() === requester.branch.toString();
    }
    return false;
  }
  
  return false;
}

/**
 * Get all available roles based on requester's role
 */
export function getAvailableRoles(requester: AuthResult): UserRole[] {
  if (requester.isSuperAdmin) {
    return ['superadmin', 'admin', 'member', 'user'];
  }
  if (requester.isAdmin) {
    return ['member', 'user'];
  }
  return [];
}

/**
 * Initialize the system with default branch and superadmin
 */
export async function initializeSystem(superAdminEmail: string) {
  await dbConnect();

  // Create default branch "الزرقا" if not exists
  let defaultBranch = await Branch.findOne({ code: 'ZARQA' });
  if (!defaultBranch) {
    defaultBranch = await Branch.create({
      name: 'الزرقا',
      code: 'ZARQA',
      address: 'فرع الزرقا',
      isActive: true,
    });
  }

  // Find and update the superadmin user
  const superAdmin = await User.findOneAndUpdate(
    { email: superAdminEmail },
    { 
      role: 'superadmin',
      // SuperAdmin doesn't need a branch (can see all)
    },
    { new: true }
  );

  // Update all existing users without branch to default branch
  await User.updateMany(
    { branch: { $exists: false } },
    { 
      branch: defaultBranch._id,
      branchName: defaultBranch.name 
    }
  );

  // Remove branch from superadmin if it was set
  if (superAdmin) {
    await User.findByIdAndUpdate(superAdmin._id, {
      $unset: { branch: 1, branchName: 1 }
    });
  }

  return { defaultBranch, superAdmin };
}
