import crypto from "node:crypto";

const HKDF_SALT = Buffer.from("elhaq-assistance-nid-v1", "utf8");
const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

function getMasterSecret(): string {
  const secret =
    process.env.ASSISTANCE_NATIONAL_ID_SECRET || process.env.CLERK_SECRET_KEY;

  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "Missing or insufficient secret key for national ID cryptographic protection (configure ASSISTANCE_NATIONAL_ID_SECRET)."
    );
  }

  return secret;
}

function getDerivedKey(purpose: "encryption" | "blind-index"): Buffer {
  const masterSecret = getMasterSecret();
  const rawKey = crypto.hkdfSync(
    "sha256",
    Buffer.from(masterSecret, "utf8"),
    HKDF_SALT,
    Buffer.from(purpose, "utf8"),
    KEY_LENGTH_BYTES
  );
  return Buffer.from(rawKey);
}

/**
 * Encrypts a National ID string with AES-256-GCM using a HKDF-derived key.
 * Leading zeros and exact UTF-8 characters are preserved.
 */
export function encryptNationalId(nationalId: string): string {
  if (typeof nationalId !== "string" || nationalId.length === 0) {
    throw new Error("National ID must be a non-empty string for encryption");
  }

  const key = getDerivedKey("encryption");
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(nationalId, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/**
 * Decrypts a v1 AES-256-GCM National ID payload and verifies its authentication tag.
 */
export function decryptNationalId(payload: string): string {
  if (typeof payload !== "string") {
    throw new Error("Invalid encrypted National ID payload");
  }

  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unsupported encrypted National ID payload format");
  }

  const [, ivB64, tagB64, cipherB64] = parts;
  const key = getDerivedKey("encryption");
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(cipherB64, "base64url");

  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Computes a keyed HMAC-SHA256 blind index for exact lookup without storing
 * unsalted hashes or plaintext values in indexable fields.
 */
export function computeNationalIdBlindIndex(nationalId: string): string {
  if (typeof nationalId !== "string" || nationalId.length === 0) {
    throw new Error("National ID must be a non-empty string for blind index");
  }

  const key = getDerivedKey("blind-index");
  return crypto.createHmac("sha256", key).update(nationalId, "utf8").digest("hex");
}

/**
 * Masks a National ID for safe admin UI listing/default views while preserving length context.
 */
export function maskNationalId(nationalId?: string | null): string {
  if (!nationalId) return "—";
  const str = String(nationalId).trim();
  if (!str) return "—";
  if (str.length <= 4) {
    return "*".repeat(str.length);
  }
  return "*".repeat(Math.max(4, str.length - 4)) + str.slice(-4);
}
