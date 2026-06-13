import "server-only";
import { deployEnvironment, env, getServerAppUrl, isDatabaseConfigured } from "./env";
import { query } from "./db";
import { getMigrationStatus } from "./migrate";

/**
 * Diagnostic serveur complet et factuel : variables d'environnement, connexion
 * PostgreSQL, présence des tables critiques, dernière migration détectée,
 * environnement de déploiement et URL d'app. Aucune valeur secrète n'est
 * exposée — uniquement des booléens et des noms de table.
 */

/**
 * Tables critiques au fonctionnement live. Note : la table de stockage des
 * tokens chiffrés s'appelle `shopify_tokens` dans ce schéma (il n'existe pas
 * de table `shopify_connections`).
 */
export const CRITICAL_TABLES = [
  "shops",
  "shopify_tokens",
  "shopify_oauth_config",
  "products",
  "orders",
  "order_line_items",
  "refunds",
  "sync_runs",
] as const;

export type DiagnosticCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type SystemDiagnostic = {
  ok: boolean;
  environment: string;
  appUrl: string;
  databaseUrlPresent: boolean;
  encryptionSecretPresent: boolean;
  encryptionSecretValid: boolean;
  dbConnected: boolean;
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
  const environment = deployEnvironment();
  const appUrl = getServerAppUrl();

  let dbConnected = false;
  let tables: { name: string; present: boolean }[] = CRITICAL_TABLES.map((name) => ({ name, present: false }));
  let missingTables: string[] = [...CRITICAL_TABLES];
  let lastMigration: string | null = null;
  let pendingMigrations: string[] = [];

  if (databaseUrlPresent) {
    try {
      const rows = await query<{ table_name: string }>(
        `select table_name from information_schema.tables where table_schema = 'public'`
      );
      dbConnected = true;
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
    } catch {
      dbConnected = false;
    }
  }

  const oauthTablePresent = tables.find((t) => t.name === "shopify_oauth_config")?.present ?? false;

  const checks: DiagnosticCheck[] = [
    {
      key: "database_url",
      label: "DATABASE_URL présent",
      ok: databaseUrlPresent,
      detail: databaseUrlPresent ? "Variable configurée" : "DATABASE_URL absent des variables d'environnement",
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
      detail: !databaseUrlPresent
        ? "DATABASE_URL absent"
        : dbConnected
          ? "Connexion PostgreSQL établie"
          : "Connexion impossible (vérifier DATABASE_URL / réseau Supabase)",
    },
    {
      key: "migrations",
      label: "Migrations OK",
      ok: dbConnected && missingTables.length === 0,
      detail: !dbConnected
        ? "Base non connectée"
        : missingTables.length === 0
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
      key: "environment",
      label: "Environnement",
      ok: true,
      detail: environment,
    },
    {
      key: "app_url",
      label: "URL d'app détectée",
      ok: true,
      detail: appUrl || "Origine de la requête (NEXT_PUBLIC_APP_URL non défini)",
    },
  ];

  const ok =
    databaseUrlPresent &&
    encryptionSecretPresent &&
    encryptionSecretValid &&
    dbConnected &&
    missingTables.length === 0;

  return {
    ok,
    environment,
    appUrl,
    databaseUrlPresent,
    encryptionSecretPresent,
    encryptionSecretValid,
    dbConnected,
    tables,
    missingTables,
    oauthTablePresent,
    lastMigration,
    pendingMigrations,
    checks,
  };
}
