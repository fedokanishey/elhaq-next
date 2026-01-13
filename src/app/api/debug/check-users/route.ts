import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";

export async function GET() {
  try {
    await dbConnect();
    
    // Get all users
    const allUsers = await User.find({}).populate('branch').lean();
    
    // Group by role
    const superadmins = allUsers.filter(u => u.role === 'superadmin');
    const admins = allUsers.filter(u => u.role === 'admin');
    const members = allUsers.filter(u => u.role === 'member');
    const regularUsers = allUsers.filter(u => u.role === 'user');

    return NextResponse.json({ 
      total: allUsers.length,
      breakdown: {
        superadmins: superadmins.length,
        admins: admins.length,
        members: members.length,
        users: regularUsers.length,
      },
      superadminsList: superadmins.map(u => ({ email: u.email, role: u.role, id: u._id })),
      adminsList: admins.map(u => ({ email: u.email, role: u.role, id: u._id })),
      allUsersList: allUsers.map(u => ({ 
        email: u.email, 
        role: u.role, 
        firstName: u.firstName,
        lastName: u.lastName,
        id: u._id,
        branch: typeof u.branch === 'object' ? u.branch?.name : u.branchName
      })),
    });
  } catch (error) {
    console.error("Error checking users:", error);
    return NextResponse.json({ error: "Failed to check users", details: String(error) }, { status: 500 });
  }
}
