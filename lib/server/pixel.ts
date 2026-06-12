import "server-only";
import { query } from "./db";
import { env } from "./env";
import { getAccessToken, type ShopRow } from "./repo";
import { shopifyGraphQL } from "./shopify";

/**
 * Activation automatique du Web Pixel Shopify (scope write_pixels).
 *
 * Appelé juste après l'OAuth et via le bouton « Réinstaller le pixel » de
 * Settings. Vérifie si le pixel Orkestra existe déjà (une app = un web pixel
 * par boutique), le crée sinon, met à jour son endpoint si besoin, et stocke
 * l'ID + le statut réel en base. Jamais de faux statut : en cas d'échec,
 * pixel_status = 'error' avec le message Shopify.
 */

export type PixelResult = {
  status: "installed" | "error";
  webPixelId?: string;
  error?: string;
};

type WebPixelNode = { id: string; settings: string } | null;

async function setPixelState(
  shopId: string,
  state: { status: ShopRow["pixel_status"]; webPixelId?: string | null; error?: string | null }
): Promise<void> {
  await query(
    `update shops set pixel_status = $2,
       web_pixel_id = coalesce($3, web_pixel_id),
       pixel_error = $4,
       updated_at = now()
     where id = $1`,
    [shopId, state.status, state.webPixelId ?? null, state.error ?? null]
  );
}

async function queryExistingPixel(domain: string, token: string): Promise<WebPixelNode> {
  try {
    const data = await shopifyGraphQL<{ webPixel: WebPixelNode }>(
      domain,
      token,
      `query { webPixel { id settings } }`
    );
    return data.webPixel;
  } catch {
    // Shopify renvoie une erreur si aucun pixel n'existe pour cette app.
    return null;
  }
}

export async function ensureWebPixel(shop: ShopRow): Promise<PixelResult> {
  const token = await getAccessToken(shop.id);
  if (!token) {
    const error = "Token Shopify manquant — reconnectez la boutique.";
    await setPixelState(shop.id, { status: "error", error });
    return { status: "error", error };
  }

  const desiredSettings = JSON.stringify({ endpoint: `${env.shopifyAppUrl}/api/tracking/event` });
  await setPixelState(shop.id, { status: "installing", error: null });

  try {
    // 1. Pixel déjà présent ? (évite les doublons)
    const existing = await queryExistingPixel(shop.shopify_domain, token);
    if (existing) {
      if (existing.settings !== desiredSettings) {
        // Endpoint obsolète (changement d'URL d'app) : mise à jour
        const updated = await shopifyGraphQL<{
          webPixelUpdate: { userErrors: { message: string }[]; webPixel: { id: string } | null };
        }>(
          shop.shopify_domain,
          token,
          `mutation webPixelUpdate($id: ID!, $webPixel: WebPixelInput!) {
            webPixelUpdate(id: $id, webPixel: $webPixel) {
              userErrors { message }
              webPixel { id }
            }
          }`,
          { id: existing.id, webPixel: { settings: desiredSettings } }
        );
        const errs = updated.webPixelUpdate.userErrors;
        if (errs.length > 0) throw new Error(errs[0].message);
      }
      await setPixelState(shop.id, { status: "installed", webPixelId: existing.id, error: null });
      console.log(`[pixel] Pixel déjà actif pour ${shop.shopify_domain} (${existing.id})`);
      return { status: "installed", webPixelId: existing.id };
    }

    // 2. Création
    const created = await shopifyGraphQL<{
      webPixelCreate: { userErrors: { code?: string; message: string }[]; webPixel: { id: string } | null };
    }>(
      shop.shopify_domain,
      token,
      `mutation webPixelCreate($webPixel: WebPixelInput!) {
        webPixelCreate(webPixel: $webPixel) {
          userErrors { code message }
          webPixel { id }
        }
      }`,
      { webPixel: { settings: desiredSettings } }
    );

    const errs = created.webPixelCreate.userErrors;
    if (errs.length > 0) {
      // « TAKEN » = créé entre-temps (course) : on relit l'existant
      if (/taken/i.test(errs[0].code ?? "") || /taken/i.test(errs[0].message)) {
        const raced = await queryExistingPixel(shop.shopify_domain, token);
        if (raced) {
          await setPixelState(shop.id, { status: "installed", webPixelId: raced.id, error: null });
          return { status: "installed", webPixelId: raced.id };
        }
      }
      throw new Error(errs[0].message);
    }
    if (!created.webPixelCreate.webPixel) throw new Error("Réponse webPixelCreate sans pixel");

    const id = created.webPixelCreate.webPixel.id;
    await setPixelState(shop.id, { status: "installed", webPixelId: id, error: null });
    console.log(`[pixel] Pixel créé pour ${shop.shopify_domain} (${id})`);
    return { status: "installed", webPixelId: id };
  } catch (err) {
    // Cas le plus fréquent : l'extension web pixel n'est pas encore déployée
    // (`shopify app deploy`) — l'erreur Shopify est affichée telle quelle.
    const message = err instanceof Error ? err.message : "Erreur Shopify inconnue";
    console.error(`[pixel] Installation impossible pour ${shop.shopify_domain} :`, message);
    await setPixelState(shop.id, { status: "error", error: message });
    return { status: "error", error: message };
  }
}
