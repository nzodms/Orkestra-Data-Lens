import "server-only";
import {
  createSyncRun,
  finishSyncRun,
  getAccessToken,
  upsertOrderFromPayload,
  upsertProduct,
  type NormalizedProduct,
  type ShopifyOrderPayload,
  type ShopRow,
} from "./repo";
import { shopifyGraphQL, shopifyIdToNumeric, shopifyRestPaginated } from "./shopify";

/**
 * Synchronisation Shopify → base.
 * V1 : fenêtre de 30 jours par défaut (extensible à 90), relançable via le
 * bouton « Resynchroniser » de Settings. Chaque exécution est journalisée
 * dans sync_runs.
 */

export type SyncResult = {
  status: "success" | "error";
  products: number;
  variants: number;
  orders: number;
  lineItems: number;
  refunds: number;
  customers: number;
  errorMessage?: string;
};

// ─── Produits : GraphQL avec pagination par curseur ──────────────────────────

type ProductsPage = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      id: string;
      title: string;
      handle: string;
      vendor: string;
      productType: string;
      status: string;
      totalInventory: number | null;
      featuredImage: { url: string } | null;
      priceRangeV2: {
        minVariantPrice: { amount: string };
        maxVariantPrice: { amount: string };
      };
      variants: {
        nodes: {
          id: string;
          title: string;
          sku: string | null;
          price: string;
          compareAtPrice: string | null;
          inventoryQuantity: number | null;
          inventoryItem: { unitCost: { amount: string } | null } | null;
        }[];
      };
    }[];
  };
};

const PRODUCTS_QUERY = `
  query products($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id title handle vendor productType status totalInventory
        featuredImage { url }
        priceRangeV2 {
          minVariantPrice { amount }
          maxVariantPrice { amount }
        }
        variants(first: 100) {
          nodes {
            id title sku price compareAtPrice inventoryQuantity
            inventoryItem { unitCost { amount } }
          }
        }
      }
    }
  }`;

async function syncProducts(shop: ShopRow, token: string): Promise<{ products: number; variants: number }> {
  let cursor: string | null = null;
  let products = 0;
  let variants = 0;

  for (let page = 0; page < 40; page++) {
    const data: ProductsPage = await shopifyGraphQL<ProductsPage>(shop.shopify_domain, token, PRODUCTS_QUERY, {
      cursor,
    });
    for (const node of data.products.nodes) {
      const costs = node.variants.nodes
        .map((v) => Number(v.inventoryItem?.unitCost?.amount ?? 0))
        .filter((c) => c > 0);
      const normalized: NormalizedProduct = {
        shopifyProductId: shopifyIdToNumeric(node.id)!,
        title: node.title,
        handle: node.handle,
        vendor: node.vendor || undefined,
        productType: node.productType || undefined,
        status: node.status.toLowerCase(),
        imageUrl: node.featuredImage?.url,
        priceMin: Number(node.priceRangeV2.minVariantPrice.amount),
        priceMax: Number(node.priceRangeV2.maxVariantPrice.amount),
        cost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : undefined,
        stock: node.totalInventory ?? undefined,
        variants: node.variants.nodes.map((v) => ({
          shopifyVariantId: shopifyIdToNumeric(v.id)!,
          title: v.title,
          sku: v.sku ?? undefined,
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : undefined,
          inventoryQuantity: v.inventoryQuantity ?? undefined,
          cost: v.inventoryItem?.unitCost ? Number(v.inventoryItem.unitCost.amount) : undefined,
        })),
      };
      variants += await upsertProduct(shop.id, normalized);
      products++;
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return { products, variants };
}

// ─── Commandes : REST (expose cart_token / checkout_token + refunds inline) ──

async function syncOrders(
  shop: ShopRow,
  token: string,
  rangeDays: number
): Promise<{ orders: number; lineItems: number; refunds: number; customers: number }> {
  const since = new Date(Date.now() - rangeDays * 86400000).toISOString();
  const payloads = await shopifyRestPaginated<ShopifyOrderPayload>(
    shop.shopify_domain,
    token,
    "orders.json",
    { status: "any", limit: "250", created_at_min: since },
    (body) => (body as { orders?: ShopifyOrderPayload[] }).orders ?? []
  );

  let orders = 0;
  let lineItems = 0;
  let refunds = 0;
  const customerIds = new Set<string>();

  for (const payload of payloads) {
    const result = await upsertOrderFromPayload(shop.id, payload);
    orders++;
    lineItems += result.lineItems;
    refunds += result.refunds;
    if (payload.customer?.id != null) customerIds.add(String(payload.customer.id));
  }
  return { orders, lineItems, refunds, customers: customerIds.size };
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export async function runSync(shop: ShopRow, rangeDays = 30): Promise<SyncResult> {
  const token = await getAccessToken(shop.id);
  if (!token) {
    return {
      status: "error",
      products: 0,
      variants: 0,
      orders: 0,
      lineItems: 0,
      refunds: 0,
      customers: 0,
      errorMessage: "Token Shopify manquant ou indéchiffrable — reconnectez la boutique.",
    };
  }

  const runId = await createSyncRun(shop.id, rangeDays);
  try {
    const productResult = await syncProducts(shop, token);
    const orderResult = await syncOrders(shop, token, rangeDays);

    await finishSyncRun(runId, {
      status: "success",
      counts: {
        products_synced: productResult.products,
        variants_synced: productResult.variants,
        orders_synced: orderResult.orders,
        line_items_synced: orderResult.lineItems,
        refunds_synced: orderResult.refunds,
        customers_synced: orderResult.customers,
      },
    });

    return {
      status: "success",
      products: productResult.products,
      variants: productResult.variants,
      orders: orderResult.orders,
      lineItems: orderResult.lineItems,
      refunds: orderResult.refunds,
      customers: orderResult.customers,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de synchronisation inconnue";
    console.error(`[sync] ${shop.shopify_domain} :`, message);
    await finishSyncRun(runId, { status: "error", errorMessage: message });
    return {
      status: "error",
      products: 0,
      variants: 0,
      orders: 0,
      lineItems: 0,
      refunds: 0,
      customers: 0,
      errorMessage: message,
    };
  }
}
