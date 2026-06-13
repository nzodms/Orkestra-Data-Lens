// Exécute les migrations SQL de db/migrations dans l'ordre, de façon
// idempotente (table _migrations). Usage : npm run db:migrate
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant (voir .env.example)");
    process.exit(1);
  }
  // SSL forcé via objet explicite + sslmode retiré de l'URL (sinon pg ignore
  // rejectUnauthorized:false → « self-signed certificate in chain » avec Supabase).
  const cleanedUrl = process.env.DATABASE_URL
    .replace(/([?&])(sslmode|ssl|sslcert|sslkey|sslrootcert|uselibpqcompat)=[^&]*/gi, "$1")
    .replace(/[?&]$/, "");
  const client = new pg.Client({
    connectionString: cleanedUrl,
    ssl: /localhost|127\.0\.0\.1/.test(cleanedUrl) ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();

  await client.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const { rows } = await client.query("select 1 from _migrations where name = $1", [file]);
    if (rows.length > 0) {
      console.log(`= ${file} (déjà appliquée)`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    console.log(`> ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into _migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      console.error(`Échec de ${file} :`, err.message);
      process.exit(1);
    }
  }

  await client.end();
  console.log("Migrations à jour.");
}

main();
