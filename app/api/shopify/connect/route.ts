import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isManualConnectAvailable, SHOPIFY_API_VERSION } from "@/lib/server/env";
import { logActivity } from "@/lib/server/activity";
import { upsertManualConnection } from "@/lib/server/repo";
import { normalizeShopDomain, testConnection } from "@/lib/server/shopify";

/**
 * POST /api/shopify/connect — Mode « Token Admin API » : connexion par token manuel.
 * body : { domain, token, apiVersion?, dryRun? }
 *
 * dryRun = true → « Tester la connexion » : requêtes réelles vers Shopify
 * (shop.json + access_scopes.json), aucun stockage.
 * dryRun absent → connexion enregistrée : token chiffré AES-256-GCM, seul
 * `••••••••XXXX` est conservé en clair. Le token n'est JAMAIS renvoyé.
 */

const schema = z.object({
  domain: z.string().min(4).max(120),
  token: z.string().min(10).max(200),
  apiVersion: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Format attendu : 2025-01")
    .optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!isManualConnectAvailable()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Connexion impossible : DATABASE_URL et ENCRYPTION_SECRET (32+ caractères) doivent être configurés côté serveur.",
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

  const domain = normalizeShopDomain(parsed.data.domain);
  if (!domain) {
    return NextResponse.json(
      { ok: false, error: "Domaine invalide — format attendu : ma-boutique.myshopify.com" },
      { status: 400 }
    );
  }
  if (!/^shpat_|^shpca_|^shpua_/.test(parsed.data.token.trim())) {
    return NextResponse.json(
      { ok: false, error: "Token inattendu — un Admin API access token commence par shpat_ (app custom)." },
      { status: 400 }
    );
  }

  const apiVersion = parsed.data.apiVersion ?? SHOPIFY_API_VERSION;
  const token = parsed.data.token.trim();

  // Test réel contre l'API Shopify — jamais de faux « connecté »
  const test = await testConnection(domain, token, apiVersion);
  if (parsed.data.dryRun) {
    return NextResponse.json({
      ok: test.ok,
      dryRun: true,
      shopName: test.shopName,
      currency: test.currency,
      scopes: test.scopes,
      missingScopes: test.missingScopes,
      error: test.error,
    });
  }

  if (!test.ok) {
    return NextResponse.json(
      { ok: false, scopes: test.scopes, missingScopes: test.missingScopes, error: test.error },
      { status: 422 }
    );
  }

  try {
    const shop = await upsertManualConnection({
      domain,
      name: test.shopName,
      currency: test.currency,
      timezone: test.timezone,
      scopes: test.scopes,
      accessToken: token,
      apiVersion,
    });
    console.log(`[connect] Boutique connectée par token manuel : ${domain} (shop_id=${shop.id})`);
    await logActivity({
      entityType: "system",
      entityId: shop.id,
      action: "shop_connected",
      title: `Boutique connectée : ${domain}`,
      description: `Méthode : token Admin API · version ${apiVersion} · scopes : ${test.scopes.join(", ") || "non listés"}`,
      actorType: "user",
    });
    return NextResponse.json({
      ok: true,
      shopDomain: domain,
      shopName: test.shopName,
      tokenHint: `••••••••${token.slice(-4)}`,
      scopes: test.scopes,
      missingScopes: test.missingScopes,
    });
  } catch (err) {
    console.error("[connect] Échec de l'enregistrement :", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Erreur interne lors de l'enregistrement." }, { status: 500 });
  }
}
