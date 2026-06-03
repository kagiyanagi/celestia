import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

// Encrypted values are self-describing so legacy plaintext can be detected
// and transparently re-encrypted on the next write.
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

/**
 * In development without APP_SECRET we fall back to a generated,
 * machine-local secret so encrypted values survive restarts. Production
 * requires a real APP_SECRET (enforced by assertEnv).
 */
function getDevFallbackSecret(): string {
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, ".app-secret");

  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    const secret = randomBytes(32).toString("hex");
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

function getKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const secret = env.appSecret || (!env.isProduction ? getDevFallbackSecret() : "");

  if (!secret) {
    throw new Error("APP_SECRET is required to encrypt stored secrets.");
  }

  cachedKey = scryptSync(secret, "celestia:secret-store:v1", 32);
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Decrypts a stored secret. Legacy plaintext values (pre-encryption) are
 * returned as-is; corrupted or wrong-key values return null rather than
 * throwing so a bad record can't take down a request.
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!isEncryptedSecret(value)) {
    return value;
  }

  try {
    const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split(":");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivPart, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    console.error("Failed to decrypt stored secret", error);
    return null;
  }
}
