import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { onUserCreated, onUserUpdated, onUserDeleted } from '@/inngest/functions';

// Debugging: Log if the key exists (do not log the full key)
const signingKey = process.env.INNGEST_SIGNING_KEY;
console.log("Inngest Signing Key configured:", signingKey ? `Yes (Starts with ${signingKey.substring(0, 5)}...)` : "No");

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [onUserCreated, onUserUpdated, onUserDeleted],
  signingKey: process.env.INNGEST_SIGNING_KEY, // Explicitly pass the key
});
