/**
 * Full System Backup Service (Cron Job)
 * 
 * This service is designed for automated server-side backups.
 * It does NOT depend on any user session, branch filtering, or roles.
 * 
 * Key characteristics:
 * - Pulls ALL collections from MongoDB completely
 * - Includes ALL branches and ALL data
 * - No branch filtering whatsoever
 * - Authenticated only via CRON_SECRET
 * - Runs directly from server using server credentials
 * - Retains only the latest backup, deletes older ones
 * 
 * Cloudinary path: mongodb-backups/full-system/
 */

import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { Readable } from 'stream';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FullSystemBackupResult {
  success: boolean;
  system: 'full-project-backup';
  collectionsCount: number;
  totalDocuments: number;
  fileSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: string;
  cloudinaryUrl: string | null;
  cloudinaryPublicId: string | null;
  backupDate: string;
  durationMs: number;
  collectionsDetail: Record<string, number>;
  oldBackupsDeleted: number;
}

export interface FullBackupError {
  success: false;
  error: string;
  code: 'AUTH_FAILED' | 'DB_ERROR' | 'UPLOAD_ERROR' | 'CONFIG_ERROR' | 'UNKNOWN';
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CLOUDINARY_FOLDER = 'mongodb-backups/full-system';

/**
 * System collections to EXCLUDE from backup
 * These are MongoDB internal collections that should not be backed up
 */
const EXCLUDED_COLLECTIONS = new Set([
  'system.views',
  'system.buckets',
  'system.profile',
]);

// ─── Cloudinary Config ──────────────────────────────────────────────────────

function configureCloudinary(): void {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Missing Cloudinary configuration. Required: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

// ─── Security ───────────────────────────────────────────────────────────────

/**
 * Validates the CRON_SECRET from the Authorization header
 * 
 * Expected format: Authorization: Bearer ${CRON_SECRET}
 */
export function validateCronSecret(authorizationHeader: string | null): boolean {
  if (!authorizationHeader) {
    console.error('[FullBackup] No Authorization header provided');
    return false;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[FullBackup] CRON_SECRET not configured in environment');
    return false;
  }

  const token = authorizationHeader.replace('Bearer ', '').trim();
  
  if (token !== cronSecret) {
    console.error('[FullBackup] Invalid CRON_SECRET provided');
    return false;
  }

  return true;
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Lists all collection names in the database (excluding system collections)
 */
async function listAllCollections(): Promise<string[]> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');

  const collections = await db.listCollections().toArray();
  return collections
    .map((c) => c.name)
    .filter((name) => !EXCLUDED_COLLECTIONS.has(name))
    .sort();
}

/**
 * Fetches ALL documents from a collection with NO filtering
 */
async function fetchEntireCollection(
  collectionName: string
): Promise<Record<string, unknown>[]> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');

  const collection = db.collection(collectionName);
  const docs = await collection.find({}).toArray();
  return docs as unknown as Record<string, unknown>[];
}

/**
 * Uploads a gzipped buffer to Cloudinary as a raw file
 */
async function uploadToCloudinary(
  buffer: Buffer,
  fileName: string
): Promise<{ url: string; publicId: string }> {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: CLOUDINARY_FOLDER,
        public_id: fileName,
        overwrite: true,
        invalidate: true,
        type: 'private',
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
          return;
        }
        if (!result) {
          reject(new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
  });
}

/**
 * Deletes all old backups in the full-system folder, keeping only the latest
 */
async function deleteOldFullBackups(
  keepPublicId: string
): Promise<number> {
  configureCloudinary();
  let deletedCount = 0;

  try {
    // List all resources in the full-system folder
    const result = await cloudinary.api.resources({
      type: 'private',
      resource_type: 'raw',
      prefix: CLOUDINARY_FOLDER,
      max_results: 100,
    });

    if (result.resources && result.resources.length > 0) {
      const toDelete = result.resources
        .filter((r: { public_id: string }) => r.public_id !== keepPublicId)
        .map((r: { public_id: string }) => r.public_id);

      if (toDelete.length > 0) {
        // Cloudinary delete_resources has a max of 100 per call
        for (let i = 0; i < toDelete.length; i += 100) {
          const batch = toDelete.slice(i, i + 100);
          await cloudinary.api.delete_resources(batch, {
            resource_type: 'raw',
            type: 'private',
          });
        }
        deletedCount = toDelete.length;
      }
    }
  } catch (error) {
    console.warn('[FullBackup] Warning: Failed to cleanup old backups:', error);
  }

  return deletedCount;
}

// ─── Main Export Function ───────────────────────────────────────────────────

/**
 * Creates a full system backup of the entire MongoDB database.
 * 
 * This function:
 * 1. Connects to MongoDB
 * 2. Lists all collections
 * 3. Dumps every document from every collection (NO filtering)
 * 4. Compresses with gzip
 * 5. Uploads to Cloudinary under mongodb-backups/full-system/
 * 6. Deletes all previous backups (keeps only latest)
 * 
 * @returns Full backup result or error
 * 
 * @example
 * const result = await createFullSystemBackup();
 * if (result.success) {
 *   console.log(`Backed up ${result.totalDocuments} documents`);
 * }
 */
export async function createFullSystemBackup(): Promise<
  FullSystemBackupResult | FullBackupError
> {
  const startTime = Date.now();
  console.log('[FullBackup] ═══════════════════════════════════════');
  console.log('[FullBackup] Starting FULL SYSTEM BACKUP...');
  console.log(`[FullBackup] Timestamp: ${new Date().toISOString()}`);
  console.log('[FullBackup] ═══════════════════════════════════════');

  try {
    // ── 1. Connect to Database ──
    await dbConnect();
    console.log('[FullBackup] ✅ Database connected');

    // ── 2. List All Collections ──
    const collectionNames = await listAllCollections();
    console.log(`[FullBackup] Found ${collectionNames.length} collections: ${collectionNames.join(', ')}`);

    if (collectionNames.length === 0) {
      return {
        success: false,
        error: 'No collections found in the database',
        code: 'DB_ERROR',
      };
    }

    // ── 3. Dump All Collections ──
    const collections: Record<string, Record<string, unknown>[]> = {};
    const collectionsDetail: Record<string, number> = {};
    let totalDocuments = 0;

    for (const collectionName of collectionNames) {
      try {
        const docs = await fetchEntireCollection(collectionName);
        collections[collectionName] = docs;
        collectionsDetail[collectionName] = docs.length;
        totalDocuments += docs.length;
        console.log(`[FullBackup]   📦 ${collectionName}: ${docs.length} documents`);
      } catch (error) {
        console.error(`[FullBackup]   ⚠️ Failed to fetch ${collectionName}:`, error);
        // Continue with other collections instead of failing entirely
        collectionsDetail[collectionName] = -1; // Mark as failed
      }
    }

    console.log(`[FullBackup] ──────────────────────────────────`);
    console.log(`[FullBackup] Total documents: ${totalDocuments}`);

    // ── 4. Build Backup Object ──
    const backupDate = new Date().toISOString();
    const backupData = {
      system: 'full-project-backup' as const,
      backupType: 'automatic-full-system',
      backupDate,
      mongodbUri: maskConnectionString(process.env.MONGODB_URI || ''),
      databaseName: mongoose.connection.db?.databaseName || 'unknown',
      collectionsCount: Object.keys(collections).length,
      totalDocuments,
      collectionsDetail,
      collections,
    };

    // ── 5. Compress Data ──
    const jsonString = JSON.stringify(backupData, null, 2);
    const originalSize = Buffer.byteLength(jsonString, 'utf-8');
    const compressed = await gzipAsync(Buffer.from(jsonString, 'utf-8'));
    const compressedSize = compressed.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(
      `[FullBackup] 🗜️ Compression: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${compressionRatio}% reduction)`
    );

    // ── 6. Upload to Cloudinary ──
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `full-backup-${timestamp}.json.gz`;

    console.log(`[FullBackup] 📤 Uploading to Cloudinary: ${CLOUDINARY_FOLDER}/${fileName}`);
    const uploadResult = await uploadToCloudinary(compressed, fileName);
    console.log(`[FullBackup] ✅ Upload complete: ${uploadResult.publicId}`);

    // ── 7. Delete Old Backups ──
    const oldBackupsDeleted = await deleteOldFullBackups(uploadResult.publicId);
    if (oldBackupsDeleted > 0) {
      console.log(`[FullBackup] 🗑️ Deleted ${oldBackupsDeleted} old backup(s)`);
    }

    // ── 8. Return Result ──
    const durationMs = Date.now() - startTime;
    console.log('[FullBackup] ═══════════════════════════════════════');
    console.log(`[FullBackup] ✅ FULL SYSTEM BACKUP COMPLETE`);
    console.log(`[FullBackup] Duration: ${durationMs}ms (${(durationMs / 1000).toFixed(1)}s)`);
    console.log('[FullBackup] ═══════════════════════════════════════');

    return {
      success: true,
      system: 'full-project-backup',
      collectionsCount: Object.keys(collections).length,
      totalDocuments,
      fileSizeBytes: originalSize,
      compressedSizeBytes: compressedSize,
      compressionRatio: `${compressionRatio}%`,
      cloudinaryUrl: uploadResult.url,
      cloudinaryPublicId: uploadResult.publicId,
      backupDate,
      durationMs,
      collectionsDetail,
      oldBackupsDeleted,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`[FullBackup] ❌ BACKUP FAILED after ${durationMs}ms:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      code: error instanceof Error && errorMessage.includes('Cloudinary')
        ? 'UPLOAD_ERROR'
        : error instanceof Error && errorMessage.includes('configuration')
          ? 'CONFIG_ERROR'
          : 'DB_ERROR',
    };
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Masks a MongoDB connection string for safe logging
 */
function maskConnectionString(uri: string): string {
  if (!uri) return 'NOT_SET';
  try {
    const url = new URL(uri);
    url.password = '***';
    return url.toString();
  } catch {
    // If URL parsing fails, just mask the whole thing
    return uri.replace(/\/\/[^@]+@/, '//***:***@');
  }
}

/**
 * Formats bytes into human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
