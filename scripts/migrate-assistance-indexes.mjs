/**
 * Idempotent Non-Destructive Index Migration for Assistance Requests & Beneficiary Verification
 *
 * Usage:
 *   node scripts/migrate-assistance-indexes.mjs
 *
 * Safe Rollback (drop only newly added indexes if ever required):
 *   db.beneficiaries.dropIndex("spouse.nationalId_1")
 *   db.beneficiaries.dropIndex("children.nationalId_1")
 *   db.beneficiaries.dropIndex("children.idNumber_1")
 *   db.beneficiaries.dropIndex("children.spouse.nationalId_1")
 *   db.beneficiaries.dropIndex("relationships.relativeNationalId_1")
 *   // Or drop assistancerequests / assistanceauditlogs collections only if unused.
 */

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not configured in environment or .env.local");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not initialized");
  }

  // Ensure Beneficiaries verification lookup indexes (non-destructive, sparse, background)
  const beneficiariesCol = db.collection("beneficiaries");
  const beneficiaryIndexes = [
    { key: { "spouse.nationalId": 1 }, options: { sparse: true, background: true } },
    { key: { "children.nationalId": 1 }, options: { sparse: true, background: true } },
    { key: { "children.idNumber": 1 }, options: { sparse: true, background: true } },
    { key: { "children.spouse.nationalId": 1 }, options: { sparse: true, background: true } },
    { key: { "relationships.relativeNationalId": 1 }, options: { sparse: true, background: true } },
  ];

  const createdBeneficiaryIndexes = [];
  for (const idx of beneficiaryIndexes) {
    const name = await beneficiariesCol.createIndex(idx.key, idx.options);
    createdBeneficiaryIndexes.push(name);
  }

  // Ensure AssistanceRequests collection indexes
  const assistanceCol = db.collection("assistancerequests");
  const assistanceIndexes = [
    { key: { statusPriority: 1, createdAt: -1 }, options: { background: true } },
    { key: { branch: 1, statusPriority: 1, createdAt: -1 }, options: { background: true } },
    { key: { nationalIdBlindIndex: 1, createdAt: -1 }, options: { background: true } },
    { key: { beneficiary: 1, createdAt: -1 }, options: { sparse: true, background: true } },
    { key: { verificationStatus: 1, statusPriority: 1, createdAt: -1 }, options: { background: true } },
    { key: { phone: 1 }, options: { background: true } },
  ];

  const createdAssistanceIndexes = [];
  for (const idx of assistanceIndexes) {
    const name = await assistanceCol.createIndex(idx.key, idx.options);
    createdAssistanceIndexes.push(name);
  }

  // Ensure AssistanceAuditLogs collection indexes
  const auditCol = db.collection("assistanceauditlogs");
  const auditIndexes = [
    { key: { requestId: 1, createdAt: -1 }, options: { background: true } },
    { key: { actorId: 1, createdAt: -1 }, options: { background: true } },
    { key: { branch: 1, createdAt: -1 }, options: { sparse: true, background: true } },
  ];

  const createdAuditIndexes = [];
  for (const idx of auditIndexes) {
    const name = await auditCol.createIndex(idx.key, idx.options);
    createdAuditIndexes.push(name);
  }

  console.log("Migration completed successfully (zero data altered):");
  console.log("  beneficiaries indexes verified:", createdBeneficiaryIndexes.join(", "));
  console.log("  assistancerequests indexes verified:", createdAssistanceIndexes.join(", "));
  console.log("  assistanceauditlogs indexes verified:", createdAuditIndexes.join(", "));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Index migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
