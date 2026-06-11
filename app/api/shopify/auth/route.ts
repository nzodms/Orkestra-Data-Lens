import { NextRequest, NextResponse } from "next/server";

/**
 * Point d'entrée OAuth Shopify.
 *
 * TODO(prod) :
 *  1. Valider le paramètre `shop` (format *.myshopify.com).
 *  2. Générer un `state` anti-CSRF, le stocker (cookie signé ou Supabase).
 *  3. Rediriger vers
 *     https://{shop}/admin/oauth/authorize
 *       ?client_id=SHOPIFY_API_KEY
 *       &scope=read_products,read_orders,read_customers,read_checkouts,write_pixels
 *       &redirect_uri={APP_URL}/api/shopify/callback
 *       &state={state}
 */
export async function GET(req: NextRequest) {
  const shopDomain = req.nextUrl.searchParams.get("shop");

  if (!shopDomain || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shopDomain)) {
    return NextResponse.json(
      { error: "Paramètre `shop` manquant ou invalide (attendu : ma-boutique.myshopify.com)" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    mode: "demo",
    message:
      "OAuth Shopify non configuré dans cet environnement. En production, cette route redirige vers la page d'autorisation Shopify.",
    wouldRedirectTo: `https://${shopDomain}/admin/oauth/authorize?...`,
  });
}
