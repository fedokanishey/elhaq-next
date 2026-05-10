/**
 * Manual Branch Backup Service
 * 
 * Used by Admins from the Dashboard to create backups.
 * The backup file is downloaded directly to the user's device.
 * 
 * - Branch Admin: Can only backup their own branch data
 * - Super Admin: Can backup any branch
 * 
 * NO Cloudinary upload — file is returned as a downloadable response.
 */

import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { AuthResult } from '@/lib/auth-helpers';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ManualBackupOptions {
  auth: AuthResult;
  targetBranchId?: string;
  targetBranchCode?: string;
}

export interface ManualBackupResult {
  success: true;
  branch: string;
  fileName: string;
  buffer: Buffer;
  collectionsCount: number;
  totalDocuments: number;
  durationMs: number;
}

export interface BackupError {
  success: false;
  error: string;
  code: 'UNAUTHORIZED' | 'INVALID_BRANCH' | 'DB_ERROR' | 'UNKNOWN';
}

// ─── Constants ──────────────────────────────────────────────────────────────

const BRANCH_FILTERABLE_COLLECTIONS = [
  'users',
  'beneficiaries',
  'donors',
  'initiatives',
  'loans',
  'loancapitals',
  'notebooks',
  'notifications',
  'products',
  'productoperations',
  'treasurytransactions',
  'warehousemovements',
  'accountcategories',
] as const;

// ─── Core Functions ─────────────────────────────────────────────────────────

async function fetchCollectionByBranch(
  collectionName: string,
  branchId: string
): Promise<Record<string, unknown>[]> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');

  const collection = db.collection(collectionName);

  try {
    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    return (await collection.find({ branch: branchObjectId }).toArray()) as unknown as Record<string, unknown>[];
  } catch {
    return (await collection.find({ branch: branchId }).toArray()) as unknown as Record<string, unknown>[];
  }
}

// ─── Main Export ────────────────────────────────────────────────────────────

export async function createManualBackup(
  options: ManualBackupOptions
): Promise<ManualBackupResult | BackupError> {
  const startTime = Date.now();
  const { auth, targetBranchId, targetBranchCode } = options;

  console.log('[ManualBackup] Starting manual backup...');

  if (!auth.isAuthorized) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  // Determine branch
  let branchId: string;
  let branchCode: string;

  if (auth.isSuperAdmin && targetBranchId) {
    branchId = targetBranchId;
    branchCode = (targetBranchCode || targetBranchId).toLowerCase();
  } else if (auth.isAdmin && auth.branch) {
    branchId = auth.branch.toString();
    branchCode = (auth.branchName || branchId).toLowerCase().replace(/\s+/g, '-');
  } else if (auth.isSuperAdmin && !targetBranchId) {
    return { success: false, error: 'SuperAdmin must specify a target branch', code: 'INVALID_BRANCH' };
  } else {
    return { success: false, error: 'No branch assigned', code: 'INVALID_BRANCH' };
  }

  try {
    await dbConnect();

    const collections: Record<string, Record<string, unknown>[]> = {};
    let totalDocuments = 0;

    for (const name of BRANCH_FILTERABLE_COLLECTIONS) {
      try {
        const docs = await fetchCollectionByBranch(name, branchId);
        if (docs.length > 0) {
          collections[name] = docs;
          totalDocuments += docs.length;
        }
      } catch (err) {
        console.warn(`[ManualBackup] Skip ${name}:`, err);
      }
    }

    const backupData = {
      branch: branchCode,
      branchId,
      backupType: 'manual-branch',
      backupDate: new Date().toISOString(),
      createdBy: { userId: auth.userId, role: auth.role },
      collectionsCount: Object.keys(collections).length,
      totalDocuments,
      collections,
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const compressed = await gzipAsync(Buffer.from(jsonString, 'utf-8'));

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `backup-${branchCode}-${timestamp}.json.gz`;

    const durationMs = Date.now() - startTime;
    console.log(`[ManualBackup] ✅ Done in ${durationMs}ms — ${totalDocuments} docs`);

    return {
      success: true,
      branch: branchCode,
      fileName,
      buffer: compressed,
      collectionsCount: Object.keys(collections).length,
      totalDocuments,
      durationMs,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ManualBackup] ❌', msg);
    return { success: false, error: msg, code: 'DB_ERROR' };
  }
}
