import "server-only";
import { env } from "./env";

/**
 * Analyse et masque DATABASE_URL pour le diagnostic — sans jamais exposer le
 * mot de passe — et centralise la configuration SSL du driver `pg`.
 */

export type ParsedDbUrl = {
  valid: boolean;
  protocol: string | null;
  host: string | null;
  port: string | null;
  user: string | null;
  database: string | null;
  hasSslMode: boolean;
  sslMode: string | null;
  /** URL avec le mot de passe remplacé par *** (sûre à afficher / logger). */
  masked: string | null;
  parseError?: string;
};

/** Détermine la source réellement utilisée (toujours DATABASE_URL ici). */
export const DB_ENV_VAR = "DATABASE_URL";

/** Liste des variables « base » présentes dans l'environnement (sans valeur). */
export function presentDbEnvVars(): string[] {
  return ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "DIRECT_DATABASE_URL", "SUPABASE_DB_URL"].filter(
    (k) => Boolean(process.env[k])
  );
}

export function parseDatabaseUrl(raw: string): ParsedDbUrl {
  const empty: ParsedDbUrl = {
    valid: false,
    protocol: null,
    host: null,
    port: null,
    user: null,
    database: null,
    hasSslMode: false,
    sslMode: null,
    masked: null,
  };
  if (!raw) return empty;
  try {
    const u = new URL(raw);
    const sslMode = u.searchParams.get("sslmode");
    const masked =
      `${u.protocol}//${u.username ? `${u.username}:***@` : ""}${u.host}${u.pathname}` +
      (u.search ? u.search : "");
    return {
      valid: true,
      protocol: u.protocol.replace(/:$/, ""),
      host: u.hostname || null,
      port: u.port || (u.protocol.startsWith("postgres") ? "5432" : null),
      user: u.username ? decodeURIComponent(u.username) : null,
      database: u.pathname ? u.pathname.replace(/^\//, "") || null : null,
      hasSslMode: u.searchParams.has("sslmode"),
      sslMode,
      masked,
    };
  } catch (err) {
    // URL non parsable (souvent : mot de passe avec caractères spéciaux non
    // encodés en %XX). C'est en soi un diagnostic.
    return { ...empty, parseError: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Configuration SSL du driver pour Supabase/Postgres distant. On force SSL
 * (rejectUnauthorized:false pour accepter la chaîne Supabase) sauf en local.
 * Ne laisse jamais le driver ignorer SSL en distant.
 */
export function sslConfigFor(connectionString: string): false | { rejectUnauthorized: boolean } {
  return /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false };
}

export function parsedDatabaseUrl(): ParsedDbUrl {
  return parseDatabaseUrl(env.databaseUrl);
}
