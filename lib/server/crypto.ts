import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
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

/** State aléatoire opaque (anti-CSRF) — la valeur en clair va à Shopify. */
export function randomOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash SHA-256 du state — seule cette empreinte est stockée en base. */
export function hashOAuthState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

/** Masque un email avant stockage/affichage : jamais d'email client en clair. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***.${domain.split(".").pop()}`;
}
