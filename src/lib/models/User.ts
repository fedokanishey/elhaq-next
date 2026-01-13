import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'superadmin' | 'admin' | 'member' | 'user';

export interface IUser extends Document {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: UserRole;
  branch?: Types.ObjectId; // Reference to Branch model
  branchName?: string; // Cached branch name for quick access
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    firstName: String,
    lastName: String,
    profileImageUrl: String,
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'member', 'user'],
      default: 'user',
    },
    branch: { 
      type: Schema.Types.ObjectId, 
      ref: 'Branch',
      index: true 
    },
    branchName: {
      type: String,
      trim: true
    },
  },
  { timestamps: true }
);

// Index for efficient branch-based queries
UserSchema.index({ branch: 1, role: 1 });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
