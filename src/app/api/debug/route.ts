import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import Initiative from "@/lib/models/Initiative";
import Beneficiary from "@/lib/models/Beneficiary";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const conn = await dbConnect();
    const { userId } = await auth();
    const user = await currentUser();

    let actionTaken = "None";
    const currentClerkRole = user?.publicMetadata?.role;

    // AUTO-FIX: If you are logged in, make you an admin in MongoDB immediately
    if (userId && user) {
      const email = user.emailAddresses[0]?.emailAddress;
        
      await User.findOneAndUpdate(
        { $or: [{ clerkId: userId }, { email: email }] },
        { 
          role: 'admin',
          clerkId: userId,
          email: email
        },
        { new: true, upsert: true }
      );
        
      actionTaken = `User ${email} promoted to ADMIN in MongoDB.`;
    }

    const dbName = conn.connection.name;
    const host = conn.connection.host;

    const usersCount = await User.countDocuments({});
    const initiativesCount = await Initiative.countDocuments({});
    const beneficiariesCount = await Beneficiary.countDocuments({});

    const admins = await User.find({ role: 'admin' }).select('email clerkId role');
    const allInitiatives = await Initiative.find({}).select('name status');

    return NextResponse.json({
      status: "Debug & Fix Tool",
      currentUser: {
        id: userId,
        email: user?.emailAddresses[0]?.emailAddress,
        clerkRole: currentClerkRole,
      },
      actionTaken,
      database: {
        name: dbName,
        host: host,
      },
      counts: {
        users: usersCount,
        initiatives: initiativesCount,
        beneficiaries: beneficiariesCount,
      },
      adminsInDB: admins,
      initiativesList: allInitiatives
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
