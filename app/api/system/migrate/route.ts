import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isDatabaseConfigured } from "@/lib/server/env";
import { describeServerError } from "@/lib/server/errors";
import { getAllMigrationsSql, getMigrationStatus, runMigrations } from "@/lib/server/migrate";

/**
 * Application des migrations depuis l'app déployée — sans terminal local.
 *
 * GET  → statut des migrations (fichiers, appliquées, en attente) + SQL complet
 *        à coller dans Supabase SQL Editor en repli. Lecture seule, non
 *        destructive (le SQL est du DDL idempotent issu du dépôt).
 * POST → applique les migrations en attente. PROTÉGÉ par MIGRATION_SECRET :
 *        jamais accessible si la variable n'est pas configurée ou si le secret
 *        fourni ne correspond pas. Idempotent.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(provided: string | null): boolean {
  const expected = process.env.MIGRATION_SECRET ?? "";
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Garde commune : route inerte sans MIGRATION_SECRET, sinon secret exigé. */
function authorize(req: NextRequest, bodySecret: string | null): NextResponse | null {
  if (!process.env.MIGRATION_SECRET) {
    console.warn("[migrate] Refus : MIGRATION_SECRET non configuré.");
    return NextResponse.json(
      { ok: false, error: "MIGRATION_SECRET non configuré côté serveur — route désactivée." },
      { status: 503 }
    );
  }
  const headerSecret = req.headers.get("x-migration-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  if (!secretMatches(headerSecret) && !secretMatches(querySecret) && !secretMatches(bodySecret)) {
    console.warn("[migrate] Secret invalide — accès refusé.");
    return NextResponse.json({ ok: false, error: "Secret de migration invalide." }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = authorize(req, null);
  if (denied) return denied;
  try {
    const status = await getMigrationStatus();
    return NextResponse.json({ ok: true, status, sql: getAllMigrationsSql() });
  } catch (err) {
    const described = describeServerError(err);
    return NextResponse.json({ ok: false, error: described.message, code: described.code }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const bodySecret = await req
    .json()
    .then((b: { secret?: string } | null) => b?.secret ?? null)
    .catch(() => null);

  const denied = authorize(req, bodySecret);
  if (denied) return denied;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL non configuré côté serveur." }, { status: 409 });
  }

  try {
    const result = await runMigrations();
    if (result.failed) {
      const described = describeServerError(new Error(result.failed.error));
      console.error(`[migrate] Échec sur ${result.failed.name} : ${result.failed.error}`);
      return NextResponse.json(
        {
          ok: false,
          error: `Échec de la migration ${result.failed.name} : ${described.message}`,
          applied: result.applied,
          skipped: result.skipped,
          failed: result.failed,
        },
        { status: 500 }
      );
    }
    console.log(`[migrate] OK — ${result.applied.length} appliquée(s), ${result.skipped.length} ignorée(s).`);
    return NextResponse.json({
      ok: true,
      applied: result.applied,
      skipped: result.skipped,
      last: result.last,
    });
  } catch (err) {
    const described = describeServerError(err);
    console.error("[migrate] Erreur :", described.detail);
    return NextResponse.json({ ok: false, error: described.message, code: described.code }, { status: 500 });
  }
}
