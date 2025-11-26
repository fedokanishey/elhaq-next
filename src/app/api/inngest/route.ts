import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { onUserCreated, onUserUpdated, onUserDeleted } from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [onUserCreated, onUserUpdated, onUserDeleted],
});
