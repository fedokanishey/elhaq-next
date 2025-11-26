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
      
      // When using Inngest's Clerk integration, the user data is nested in event.data.data
      const user = event.data.data;
      const { id, email_addresses, first_name, last_name, profile_image_url, email } = user;
      
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

      console.log('User created in MongoDB:', dbUser);
      return dbUser;
    } catch (error) {
      console.error('Error creating user:', error);
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
      
      const user = event.data.data;
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

      console.log('User updated in MongoDB:', dbUser);
      return dbUser;
    } catch (error) {
      console.error('Error updating user:', error);
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
      
      const user = event.data.data;
      
      const result = await User.deleteOne({ clerkId: user.id });
      
      console.log('User deleted from MongoDB:', result);
      return result;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
);
