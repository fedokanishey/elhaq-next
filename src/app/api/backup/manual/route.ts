/**
 * Manual Backup API Route — Downloads backup file to user's device
 *
 * POST /api/backup/manual
 *
 * Auth: Clerk session + Admin/SuperAdmin role
 * Response: gzipped JSON file download
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { createManualBackup } from '@/services/backup/manualBackup';

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ──
    const auth = await getAuthenticatedUser();

    if (!auth.userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (!auth.isAdmin && !auth.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Admin or SuperAdmin only' }, { status: 403 });
    }

    // ── 2. Parse body ──
    let targetBranchId: string | undefined;
    let targetBranchCode: string | undefined;

    try {
      const body = await request.json();
      targetBranchId = body.targetBranchId;
      targetBranchCode = body.targetBranchCode;
    } catch {
      // No body — branch admin backs up own branch
    }

    // ── 3. Branch admin guard ──
    if (auth.isAdmin && targetBranchId && auth.branch && targetBranchId !== auth.branch.toString()) {
      return NextResponse.json({ success: false, error: 'Branch Admin can only backup their own branch' }, { status: 403 });
    }

    // ── 4. Create backup ──
    const result = await createManualBackup({ auth, targetBranchId, targetBranchCode });

    if (!result.success) {
      const statusMap: Record<string, number> = { UNAUTHORIZED: 403, INVALID_BRANCH: 400, DB_ERROR: 500, UNKNOWN: 500 };
      return NextResponse.json(result, { status: statusMap[result.code] || 500 });
    }

    // ── 5. Return as downloadable file ──
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': result.buffer.length.toString(),
        'X-Backup-Branch': result.branch,
        'X-Backup-Documents': result.totalDocuments.toString(),
        'X-Backup-Collections': result.collectionsCount.toString(),
        'X-Backup-Duration-Ms': result.durationMs.toString(),
      },
    });
  } catch (error) {
    console.error('[API:ManualBackup] ❌', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
