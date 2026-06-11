import "server-only";
import { Pool, type QueryResultRow } from "pg";
import { env, isDatabaseConfigured } from "./env";

/**
 * Pool PostgreSQL partagé (singleton survivant au hot-reload Next).
 * Toutes les requêtes passent par `query()` — paramétrées, jamais de
 * concaténation SQL.
 */

const globalForDb = globalThis as unknown as { __orkestraPool?: Pool };

export function getPool(): Pool {
  if (!isDatabaseConfigured()) {
    throw new DbNotConfiguredError();
  }
  if (!globalForDb.__orkestraPool) {
    globalForDb.__orkestraPool = new Pool({
      connectionString: env.databaseUrl,
      max: 5,
      // Supabase (pooler ou direct) requiert SSL en distant ; on l'active
      // sauf pour un Postgres local.
      ssl: /localhost|127\.0\.0\.1/.test(env.databaseUrl) ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalForDb.__orkestraPool;
}

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL non configuré");
    this.name = "DbNotConfiguredError";
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as never[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** SELECT 1 — utilisé par la page de diagnostic. */
export async function pingDb(): Promise<boolean> {
  try {
    await query("select 1");
    return true;
  } catch {
    return false;
  }
}
