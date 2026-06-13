import "server-only";
import { deployEnvironment, env, getServerAppUrl, isDatabaseConfigured } from "./env";
import { query, testDbConnection } from "./db";
import { describeDbError, type DbError } from "./errors";
import { parsedDatabaseUrl, presentDbEnvVars } from "./dbUrl";
import { getMigrationStatus } from "./migrate";

/**
 * Diagnostic serveur complet et factuel : variables d'environnement, connexion
 * PostgreSQL (avec l'erreur RÉELLE en cas d'échec), présence des tables
 * critiques, dernière migration, environnement et URL d'app. Aucune valeur
 * secrète n'est exposée — le mot de passe DATABASE_URL est toujours masqué.
 */

/**
 * Tables critiques au fonctionnement live. Note : la table des tokens chiffrés
 * s'appelle `shopify_tokens` (il n'existe pas de table `shopify_connections`).
 */
export const CRITICAL_TABLES = [
  "shops",
  "shopify_tokens",
  "shopify_oauth_config",
  "oauth_states",
  "products",
  "orders",
  "order_line_items",
  "refunds",
  "sync_runs",
] as const;

export type DiagnosticCheck = { key: string; label: string; ok: boolean; detail: string };

export type SystemDiagnostic = {
  ok: boolean;
  runtime: string;
  vercelEnv: string;
  appUrl: string;
  databaseUrlPresent: boolean;
  encryptionSecretPresent: boolean;
  encryptionSecretValid: boolean;
  dbConnected: boolean;
  dbSelect1: unknown | null;
  /** Erreur PostgreSQL réelle si la connexion échoue (jamais de mot de passe). */
  dbError: DbError | null;
  // URL masquée + composants extraits (sans mot de passe)
  databaseUrlMasked: string | null;
  databaseUrlHost: string | null;
  databaseUrlUser: string | null;
  databaseUrlPort: string | null;
  databaseUrlDatabase: string | null;
  databaseUrlHasSslMode: boolean;
  databaseUrlParseError?: string;
  detectedDbEnvVars: string[];
  tables: { name: string; present: boolean }[];
  missingTables: string[];
  oauthTablePresent: boolean;
  lastMigration: string | null;
  pendingMigrations: string[];
  checks: DiagnosticCheck[];
};

export async function runSystemDiagnostic(): Promise<SystemDiagnostic> {
  const databaseUrlPresent = isDatabaseConfigured();
  const encryptionSecretPresent = Boolean(env.encryptionSecret);
  const encryptionSecretValid = env.encryptionSecret.length >= 32;
  const vercelEnv = deployEnvironment();
  const appUrl = getServerAppUrl();
  const parsed = parsedDatabaseUrl();
  const detectedDbEnvVars = presentDbEnvVars();

  let dbConnected = false;
  let dbSelect1: unknown | null = null;
  let dbError: DbError | null = null;
  let tables: { name: string; present: boolean }[] = CRITICAL_TABLES.map((name) => ({ name, present: false }));
  let missingTables: string[] = [...CRITICAL_TABLES];
  let lastMigration: string | null = null;
  let pendingMigrations: string[] = [];

  if (databaseUrlPresent) {
    // Test de connexion isolé : capture l'erreur réelle (code/message/detail/hint).
    const test = await testDbConnection();
    if (test.ok) {
      dbConnected = true;
      dbSelect1 = test.select1;
    } else {
      dbError = describeDbError(test.error);
    }
  }

  // Les tables/migrations ne sont inspectées QUE si la connexion fonctionne.
  if (dbConnected) {
    try {
      const rows = await query<{ table_name: string }>(
        `select table_name from information_schema.tables where table_schema = 'public'`
      );
      const present = new Set(rows.map((r) => r.table_name));
      tables = CRITICAL_TABLES.map((name) => ({ name, present: present.has(name) }));
      missingTables = tables.filter((t) => !t.present).map((t) => t.name);
      try {
        const status = await getMigrationStatus();
        lastMigration = status.last;
        pendingMigrations = status.pending;
      } catch {
        // table _migrations absente : migrations jamais appliquées via le runner
      }
    } catch (err) {
      // Connexion OK mais lecture du schéma impossible : on remonte l'erreur réelle.
      dbError = describeDbError(err);
    }
  }

  const oauthTablePresent = dbConnected && (tables.find((t) => t.name === "shopify_oauth_config")?.present ?? false);
  const oauthStatesTablePresent = dbConnected && (tables.find((t) => t.name === "oauth_states")?.present ?? false);

  const dbDetail = !databaseUrlPresent
    ? "DATABASE_URL absent"
    : dbConnected
      ? `Connexion OK (${parsed.host ?? "?"}:${parsed.port ?? "?"}) · select 1 = ${JSON.stringify(dbSelect1)}`
      : dbError
        ? `${dbError.message} [${dbError.code}] — ${dbError.hint}`
        : "Connexion impossible";

  const checks: DiagnosticCheck[] = [
    {
      key: "database_url",
      label: "DATABASE_URL présent",
      ok: databaseUrlPresent,
      detail: databaseUrlPresent
        ? `${parsed.masked ?? "(non parsable)"}${parsed.parseError ? ` · URL invalide : ${parsed.parseError}` : ""}`
        : "DATABASE_URL absent des variables d'environnement",
    },
    {
      key: "encryption_secret",
      label: "Secret de chiffrement OK",
      ok: encryptionSecretPresent && encryptionSecretValid,
      detail: !encryptionSecretPresent
        ? "ENCRYPTION_SECRET absent"
        : !encryptionSecretValid
          ? "ENCRYPTION_SECRET trop court (32 caractères minimum)"
          : "ENCRYPTION_SECRET configuré (32+ caractères)",
    },
    {
      key: "db_connected",
      label: "Base PostgreSQL connectée",
      ok: dbConnected,
      detail: dbDetail,
    },
    {
      key: "environment",
      label: "Environnement",
      ok: true,
      detail: `${vercelEnv} · runtime nodejs`,
    },
    {
      key: "app_url",
      label: "URL d'app détectée",
      ok: true,
      detail: appUrl || "Origine de la requête (NEXT_PUBLIC_APP_URL non défini)",
    },
  ];

  // On ne parle de migrations / table OAuth QUE si la connexion DB fonctionne.
  if (dbConnected) {
    checks.push(
      {
        key: "migrations",
        label: "Migrations OK",
        ok: missingTables.length === 0,
        detail:
          missingTables.length === 0
            ? `Toutes les tables critiques présentes (dernière migration : ${lastMigration ?? "inconnue"})`
            : missingTables.map((t) => `Migration manquante : table ${t} absente.`).join(" "),
      },
      {
        key: "oauth_table",
        label: "Table OAuth OK",
        ok: oauthTablePresent,
        detail: oauthTablePresent
          ? "Table shopify_oauth_config présente"
          : "Migration manquante : table shopify_oauth_config absente.",
      },
      {
        key: "oauth_state_storage",
        label: "OAuth state storage OK",
        ok: oauthStatesTablePresent,
        detail: oauthStatesTablePresent
          ? "Stockage DB du state anti-CSRF (table oauth_states) — robuste serverless, pas de dépendance cookie."
          : "Migration manquante : table oauth_states absente.",
      }
    );
  } else {
    checks.push({
      key: "migrations",
      label: "Migrations",
      ok: false,
      detail: "En attente de la connexion DB — corrigez d'abord la connexion ci-dessus (les migrations ne peuvent pas s'exécuter).",
    });
  }

  const ok =
    databaseUrlPresent &&
    encryptionSecretPresent &&
    encryptionSecretValid &&
    dbConnected &&
    missingTables.length === 0;

  return {
    ok,
    runtime: "nodejs",
    vercelEnv,
    appUrl,
    databaseUrlPresent,
    encryptionSecretPresent,
    encryptionSecretValid,
    dbConnected,
    dbSelect1,
    dbError,
    databaseUrlMasked: parsed.masked,
    databaseUrlHost: parsed.host,
    databaseUrlUser: parsed.user,
    databaseUrlPort: parsed.port,
    databaseUrlDatabase: parsed.database,
    databaseUrlHasSslMode: parsed.hasSslMode,
    databaseUrlParseError: parsed.parseError,
    detectedDbEnvVars,
    tables,
    missingTables,
    oauthTablePresent,
    lastMigration,
    pendingMigrations,
    checks,
  };
}
