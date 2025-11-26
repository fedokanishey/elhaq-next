import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { onUserCreated, onUserUpdated, onUserDeleted } from '@/inngest/functions';

// Debugging: Log key status
const key = process.env.INNGEST_SIGNING_KEY;
if (!key) {
  console.error("❌ INNGEST_SIGNING_KEY is missing in environment variables!");
} else if (!key.startsWith("signkey-")) {
  console.error(`❌ INNGEST_SIGNING_KEY looks invalid. It should start with 'signkey-', but starts with '${key.substring(0, 8)}...'`);
} else {
  console.log("✅ INNGEST_SIGNING_KEY is present and has correct prefix.");
}

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [onUserCreated, onUserUpdated, onUserDeleted],
  signingKey: key,
});
