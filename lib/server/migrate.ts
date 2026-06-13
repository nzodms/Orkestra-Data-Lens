import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPool, query } from "./db";

/**
 * Application des migrations SQL depuis l'app déployée (sans terminal local).
 *
 * Source unique : les fichiers db/migrations/*.sql (mêmes que `npm run
 * db:migrate`). Sur Vercel ils sont inclus dans le bundle via
 * `outputFileTracingIncludes` (next.config.ts). Idempotent : chaque migration
 * appliquée est tracée dans la table _migrations et n'est jamais rejouée.
 */

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

export type MigrationFile = { name: string; sql: string };

export function loadMigrationFiles(): MigrationFile[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8") }));
}

/** SQL complet de toutes les migrations, prêt à coller dans Supabase SQL Editor. */
export function getAllMigrationsSql(): string {
  try {
    const files = loadMigrationFiles();
    return files
      .map((f) => `-- ╔══ ${f.name} ══╗\n${f.sql.trim()}\n`)
      .join("\n");
  } catch (err) {
    return `-- Impossible de lire les fichiers de migration : ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

/** Migrations déjà enregistrées dans _migrations (vide si la table n'existe pas). */
export async function getAppliedMigrations(): Promise<string[]> {
  try {
    const rows = await query<{ name: string }>("select name from _migrations order by name");
    return rows.map((r) => r.name);
  } catch {
    return [];
  }
}

export type MigrationStatus = {
  files: string[];
  applied: string[];
  pending: string[];
  last: string | null;
};

export async function getMigrationStatus(): Promise<MigrationStatus> {
  let files: string[] = [];
  try {
    files = loadMigrationFiles().map((f) => f.name);
  } catch {
    files = [];
  }
  const applied = await getAppliedMigrations();
  const appliedSet = new Set(applied);
  const pending = files.filter((f) => !appliedSet.has(f));
  return { files, applied, pending, last: applied.length > 0 ? applied[applied.length - 1] : null };
}

export type MigrationResult = {
  applied: string[];
  skipped: string[];
  failed: { name: string; error: string } | null;
  last: string | null;
};

/**
 * Applique les migrations en attente, chacune dans sa propre transaction.
 * Idempotent : les migrations déjà tracées sont ignorées. S'arrête à la
 * première erreur (rollback de la migration fautive).
 */
export async function runMigrations(): Promise<MigrationResult> {
  const pool = getPool();
  await ensureMigrationsTable();

  const files = loadMigrationFiles();
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const exists = await query<{ name: string }>("select name from _migrations where name = $1", [file.name]);
    if (exists.length > 0) {
      skipped.push(file.name);
      console.log(`[migrate] = ${file.name} (déjà appliquée)`);
      continue;
    }

    const client = await pool.connect();
    try {
      console.log(`[migrate] > ${file.name}`);
      await client.query("begin");
      await client.query(file.sql);
      await client.query("insert into _migrations (name) values ($1)", [file.name]);
      await client.query("commit");
      applied.push(file.name);
      console.log(`[migrate] ✓ ${file.name}`);
    } catch (err) {
      await client.query("rollback").catch(() => {});
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[migrate] ✗ ${file.name} : ${message}`);
      client.release();
      const all = await getAppliedMigrations();
      return {
        applied,
        skipped,
        failed: { name: file.name, error: message },
        last: all.length > 0 ? all[all.length - 1] : null,
      };
    }
    client.release();
  }

  const all = await getAppliedMigrations();
  console.log(`[migrate] Terminé : ${applied.length} appliquée(s), ${skipped.length} ignorée(s).`);
  return { applied, skipped, failed: null, last: all.length > 0 ? all[all.length - 1] : null };
}
