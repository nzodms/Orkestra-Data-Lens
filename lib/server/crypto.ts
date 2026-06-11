import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Chiffrement des tokens Shopify (AES-256-GCM) et signature du state OAuth.
 * La clé dérive d'ENCRYPTION_SECRET — jamais stockée, jamais côté client.
 */

function key(): Buffer {
  if (!env.encryptionSecret) throw new Error("ENCRYPTION_SECRET manquant");
  return createHash("sha256").update(env.encryptionSecret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Format de token chiffré invalide");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

// ─── State OAuth signé (anti-CSRF, porté par un cookie HttpOnly) ─────────────

export function createSignedState(shopDomain: string): string {
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${nonce}.${Date.now()}.${shopDomain}`;
  const sig = createHmac("sha256", key()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySignedState(state: string, maxAgeMs = 10 * 60 * 1000): { shopDomain: string } | null {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [nonce, ts, shopDomain, sig] = parts;
  const payload = `${nonce}.${ts}.${shopDomain}`;
  const expected = createHmac("sha256", key()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() - Number(ts) > maxAgeMs) return null;
  return { shopDomain };
}

/** Masque un email avant stockage/affichage : jamais d'email client en clair. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***.${domain.split(".").pop()}`;
}
