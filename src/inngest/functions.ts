import { inngest } from './client';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

// Handle Clerk user.created event
export const onUserCreated = inngest.createFunction(
  { id: 'clerk-user-created' },
  { event: 'clerk/user.created' },
  async ({ event }) => {
    try {
      await dbConnect();
      
      console.log("🚀 Received user.created event:", JSON.stringify(event, null, 2));

      // Handle different payload structures (Direct Integration vs Webhook)
      const user = event.data.data || event.data;
      
      if (!user) {
        console.error("❌ No user data found in event payload");
        return;
      }

      const { id, email_addresses, first_name, last_name, profile_image_url, email } = user;
      
      if (!id) {
         console.error("❌ User ID missing in payload:", user);
         return;
      }

      const dbUser = await User.findOneAndUpdate(
        { clerkId: id },
        {
          clerkId: id,
          email: email_addresses?.[0]?.email_address || email,
          firstName: first_name,
          lastName: last_name,
          profileImageUrl: profile_image_url,
          role: 'user',
        },
        { upsert: true, new: true }
      );

      console.log('✅ User created/updated in MongoDB:', dbUser);
      return dbUser;
    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw error;
    }
  }
);

// Handle Clerk user.updated event
export const onUserUpdated = inngest.createFunction(
  { id: 'clerk-user-updated' },
  { event: 'clerk/user.updated' },
  async ({ event }) => {
    try {
      await dbConnect();
      
      console.log("🚀 Received user.updated event:", JSON.stringify(event, null, 2));

      const user = event.data.data || event.data;
      
      if (!user || !user.id) {
        console.error("❌ Invalid user data in updated event:", user);
        return;
      }

      const { id, email_addresses, first_name, last_name, profile_image_url, email } = user;
      
      const dbUser = await User.findOneAndUpdate(
        { clerkId: id },
        {
          email: email_addresses?.[0]?.email_address || email,
          firstName: first_name,
          lastName: last_name,
          profileImageUrl: profile_image_url,
        },
        { new: true }
      );

      console.log('✅ User updated in MongoDB:', dbUser);
      return dbUser;
    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw error;
    }
  }
);

// Handle Clerk user.deleted event
export const onUserDeleted = inngest.createFunction(
  { id: 'clerk-user-deleted' },
  { event: 'clerk/user.deleted' },
  async ({ event }) => {
    try {
      await dbConnect();
      
      console.log("🚀 Received user.deleted event:", JSON.stringify(event, null, 2));

      const user = event.data.data || event.data;
      
      if (!user || !user.id) {
         console.error("❌ Invalid user data in deleted event:", user);
         return;
      }
      
      const result = await User.deleteOne({ clerkId: user.id });
      
      console.log('✅ User deleted from MongoDB:', result);
      return result;
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      throw error;
    }
  }
);
