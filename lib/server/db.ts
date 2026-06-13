import "server-only";
import { Client, Pool, type QueryResultRow } from "pg";
import { env, isDatabaseConfigured } from "./env";
import { sslConfigFor } from "./dbUrl";

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
      // SSL forcé en distant (Supabase pooler/direct) — jamais ignoré.
      ssl: sslConfigFor(env.databaseUrl),
      // Échec rapide plutôt qu'un blocage si l'hôte/port est injoignable.
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
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

/**
 * Test de connexion isolé pour le diagnostic : nouvelle connexion dédiée avec
 * timeout court, exécute `select 1 as ok` et retourne l'erreur BRUTE en cas
 * d'échec (pour en extraire code/message/detail/hint réels). N'utilise pas le
 * pool partagé afin de ne jamais bloquer et de toujours tester la config réelle.
 */
export async function testDbConnection(): Promise<
  { ok: true; select1: unknown } | { ok: false; error: unknown }
> {
  if (!isDatabaseConfigured()) return { ok: false, error: new DbNotConfiguredError() };
  const client = new Client({
    connectionString: env.databaseUrl,
    ssl: sslConfigFor(env.databaseUrl),
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
  });
  try {
    await client.connect();
    const res = await client.query("select 1 as ok");
    return { ok: true, select1: res.rows[0] };
  } catch (error) {
    return { ok: false, error };
  } finally {
    await client.end().catch(() => {});
  }
}
