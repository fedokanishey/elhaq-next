/**
 * Full System Cron Backup API Route
 * 
 * GET /api/backup/cron
 * 
 * Authentication: CRON_SECRET via Authorization header
 * Authorization: No user/session dependency
 * 
 * This endpoint is designed to be called by Vercel Cron Jobs.
 * It creates a complete backup of the entire MongoDB database.
 * 
 * Headers:
 * - Authorization: Bearer ${CRON_SECRET}
 * 
 * Response:
 * - 200: Full backup completed successfully
 * - 401: Invalid or missing CRON_SECRET
 * - 500: Backup failed
 * 
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/backup/cron",
 *     "schedule": "0 3 1 * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createFullSystemBackup,
  validateCronSecret,
} from '@/services/backup/fullSystemBackup';

export const maxDuration = 300; // 5 minutes max for Vercel serverless
export const dynamic = 'force-dynamic'; // Never cache this route

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ── 1. Validate CRON_SECRET ──
    const authHeader = request.headers.get('authorization');

    if (!validateCronSecret(authHeader)) {
      console.error('[API:CronBackup] ❌ Authentication failed');
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Invalid or missing CRON_SECRET',
          code: 'AUTH_FAILED',
        },
        { status: 401 }
      );
    }

    console.log('[API:CronBackup] ✅ CRON_SECRET validated');
    console.log(`[API:CronBackup] Starting full system backup at ${new Date().toISOString()}`);

    // ── 2. Execute Full System Backup ──
    const result = await createFullSystemBackup();

    if (!result.success) {
      const statusMap: Record<string, number> = {
        AUTH_FAILED: 401,
        DB_ERROR: 500,
        UPLOAD_ERROR: 500,
        CONFIG_ERROR: 500,
        UNKNOWN: 500,
      };
      const status = statusMap[(result as { code: string }).code] || 500;

      console.error('[API:CronBackup] ❌ Backup failed:', result);
      return NextResponse.json(result, { status });
    }

    // ── 3. Return Success ──
    const durationMs = Date.now() - startTime;
    console.log(`[API:CronBackup] ✅ Full system backup completed in ${durationMs}ms`);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[API:CronBackup] ❌ Unexpected error after ${durationMs}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'UNKNOWN',
      },
      { status: 500 }
    );
  }
}
