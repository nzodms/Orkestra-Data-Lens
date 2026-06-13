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

/**
 * Retire les paramètres SSL de l'URL (sslmode, ssl, sslcert…).
 *
 * CRITIQUE : si `sslmode=require` reste dans la connectionString, node-postgres
 * IGNORE l'objet `ssl: { rejectUnauthorized: false }` qu'on passe (il le réduit
 * à `{}` et applique verify-full) → « self-signed certificate in chain » avec
 * le pooler Supabase. En retirant sslmode de l'URL et en passant l'objet ssl
 * explicitement, la config rejectUnauthorized:false est bien appliquée.
 */
export function stripSslParams(connectionString: string): string {
  if (!connectionString) return connectionString;
  try {
    const u = new URL(connectionString);
    for (const k of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) {
      u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    // URL non parsable : on retire les paramètres ssl par regex (repli).
    return connectionString.replace(/([?&])(sslmode|ssl|sslcert|sslkey|sslrootcert|uselibpqcompat)=[^&]*/gi, "$1").replace(/[?&]$/, "");
  }
}

/**
 * Config unique passée à TOUT client/pool `pg` (pool partagé, test de
 * connexion, scripts). SSL forcé en distant via objet explicite — jamais via
 * sslmode dans l'URL.
 */
export function pgClientConfig(connectionString: string): {
  connectionString: string;
  ssl: false | { rejectUnauthorized: boolean };
  connectionTimeoutMillis: number;
} {
  const cleaned = stripSslParams(connectionString);
  return {
    connectionString: cleaned,
    ssl: sslConfigFor(cleaned),
    connectionTimeoutMillis: 10_000,
  };
}

export function parsedDatabaseUrl(): ParsedDbUrl {
  return parseDatabaseUrl(env.databaseUrl);
}
