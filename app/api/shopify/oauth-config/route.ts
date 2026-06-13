import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isManualConnectAvailable } from "@/lib/server/env";
import { getOAuthAppConfig, getOAuthAppConfigPublic, saveOAuthAppConfig } from "@/lib/server/repo";
import { normalizeShopDomain } from "@/lib/server/shopify";

/**
 * Configuration OAuth « Dev Dashboard » saisie dans l'interface.
 *
 * GET  → renvoie la config publique (Client ID, scopes, URL d'app — jamais le
 *        secret) pour pré-remplir le formulaire.
 * POST → enregistre Client ID + Client Secret + scopes + URL d'app. Le secret
 *        est chiffré AES-256-GCM en base, jamais réaffiché. Si un `shop` est
 *        fourni, renvoie l'URL OAuth à suivre pour lancer l'autorisation.
 *
 * Aucune validation `shpat_` ici : ce mode n'utilise pas de token Admin API
 * mais le flux OAuth complet du nouveau Dev Dashboard.
 */

const schema = z.object({
  clientId: z.string().trim().min(8, "Client ID trop court").max(200),
  // Optionnel : si omis et qu'une config existe déjà, le secret est conservé.
  clientSecret: z.string().trim().min(8, "Client Secret trop court").max(400).optional(),
  scopes: z.string().trim().min(3).max(500),
  appUrl: z.string().trim().url("URL d'application invalide").max(300),
  shop: z.string().trim().max(120).optional(),
});

export async function GET() {
  if (!isManualConnectAvailable()) {
    return NextResponse.json({ ok: false, config: null });
  }
  try {
    const config = await getOAuthAppConfigPublic();
    return NextResponse.json({ ok: true, config });
  } catch {
    return NextResponse.json({ ok: false, config: null });
  }
}

export async function POST(req: NextRequest) {
  if (!isManualConnectAvailable()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Configuration impossible : DATABASE_URL et ENCRYPTION_SECRET (32+ caractères) doivent être configurés côté serveur.",
      },
      { status: 409 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Payload invalide" },
      { status: 400 }
    );
  }

  const { clientId, scopes, appUrl } = parsed.data;

  // Secret : nouvelle saisie, sinon on conserve celui déjà enregistré.
  let clientSecret = parsed.data.clientSecret;
  if (!clientSecret) {
    const existing = await getOAuthAppConfig().catch(() => null);
    if (!existing?.clientSecret) {
      return NextResponse.json(
        { ok: false, error: "Client Secret requis (aucun secret enregistré pour le moment)." },
        { status: 400 }
      );
    }
    clientSecret = existing.clientSecret;
  }

  // Normalisation des scopes (séparés par virgule, sans espaces parasites)
  const normalizedScopes = scopes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");

  try {
    await saveOAuthAppConfig({ clientId, clientSecret, scopes: normalizedScopes, appUrl });
  } catch (err) {
    console.error("[oauth-config] Échec de l'enregistrement :", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Erreur interne lors de l'enregistrement." }, { status: 500 });
  }

  // Si une boutique est fournie, on renvoie l'URL OAuth interne à suivre.
  let authorizeUrl: string | null = null;
  if (parsed.data.shop) {
    const domain = normalizeShopDomain(parsed.data.shop);
    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Domaine invalide — format attendu : ma-boutique.myshopify.com" },
        { status: 400 }
      );
    }
    authorizeUrl = `/api/shopify/auth?shop=${encodeURIComponent(domain)}`;
  }

  return NextResponse.json({
    ok: true,
    clientId,
    scopes: normalizedScopes,
    appUrl: appUrl.replace(/\/$/, ""),
    authorizeUrl,
  });
}
