import { NextResponse } from "next/server";
import { runSystemDiagnostic } from "@/lib/server/systemDiagnostic";

/**
 * GET /api/system/diagnostic — état serveur (env, DB, tables, migrations).
 * Lecture seule, aucune valeur secrète exposée.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostic = await runSystemDiagnostic();
  return NextResponse.json(diagnostic, { status: diagnostic.ok ? 200 : 503 });
}
