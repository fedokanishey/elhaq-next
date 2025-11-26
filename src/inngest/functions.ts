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
      
      const { data } = event;
      
      const user = await User.findOneAndUpdate(
        { clerkId: data.id },
        {
          clerkId: data.id,
          email: data.email_addresses?.[0]?.email_address || data.email,
          firstName: data.first_name,
          lastName: data.last_name,
          profileImageUrl: data.profile_image_url,
          role: 'user',
        },
        { upsert: true, new: true }
      );

      console.log('User created in MongoDB:', user);
      return user;
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
      
      const { data } = event;
      
      const user = await User.findOneAndUpdate(
        { clerkId: data.id },
        {
          email: data.email_addresses?.[0]?.email_address || data.email,
          firstName: data.first_name,
          lastName: data.last_name,
          profileImageUrl: data.profile_image_url,
        },
        { new: true }
      );

      console.log('User updated in MongoDB:', user);
      return user;
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
      
      const { data } = event;
      
      const result = await User.deleteOne({ clerkId: data.id });
      
      console.log('User deleted from MongoDB:', result);
      return result;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
);
