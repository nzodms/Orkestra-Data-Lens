import { NextRequest, NextResponse } from "next/server";
import { computeProductSourcing, SOURCING_STATUS_LABELS } from "@/lib/orderdesk/productSourcing";
import { estimatedMarginPct, NEXT_ACTIONS, OPS_STATUS_LABELS } from "@/lib/orderdesk/types";
import { getActiveDataset } from "@/lib/server/datasource";
import { runChecks, computeDataHealth } from "@/lib/server/diagnostics";
import { getDeskContext } from "@/lib/server/orderdesk";

/**
 * GET /api/export?type=…&format=json|csv
 * Exports utiles, fonctionnels en mode démo comme en live :
 * sessions · sessions_suspect · orders · orders_todo · suppliers · messages ·
 * products_resource · anomalies · activity · diagnostic
 */

type Row = Record<string, unknown>;

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return ["﻿" + headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))].join("\n");
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "sessions";
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";

  const [{ dataset, mode }, { data: desk }] = await Promise.all([getActiveDataset(), getDeskContext()]);

  let payload: unknown;
  let rows: Row[] = [];

  switch (type) {
    case "orders":
      payload = dataset.orders;
      rows = dataset.orders.map((o) => ({
        commande: o.orderNumber,
        date: o.createdAt,
        total: o.totalPrice,
        devise: o.currency,
        statut_paiement: o.financialStatus,
        session: o.sessionId ?? "",
        source: o.source ?? "",
        pays: o.country ?? "",
      }));
      break;

    case "orders_todo": {
      const todo = desk.orders.filter((o) => !["shipped", "sav"].includes(o.opsStatus));
      payload = todo;
      rows = todo.map((o) => ({
        commande: o.orderNumber,
        date: o.createdAt,
        client: o.customerMasked ?? "",
        pays: o.country ?? "",
        produit: o.lineItems[0]?.title ?? "",
        quantite: o.lineItems[0]?.quantity ?? "",
        total: o.totalPrice,
        statut: OPS_STATUS_LABELS[o.opsStatus],
        fournisseur: desk.suppliers.find((s) => s.id === o.supplierId)?.name ?? "",
        cout_fournisseur: o.supplierCost ?? "",
        marge_estimee_pct: estimatedMarginPct(o, desk.offers) ?? "",
        tracking: o.trackingNumber ?? "",
        prochaine_action: NEXT_ACTIONS[o.opsStatus],
      }));
      break;
    }

    case "suppliers":
      payload = desk.suppliers;
      rows = desk.suppliers.map((s) => ({
        nom: s.name,
        pays: s.country ?? "",
        whatsapp: s.whatsapp ?? "",
        email: s.email ?? "",
        devise: s.currency,
        delai_moyen_j: s.avgLeadTimeDays ?? "",
        fiabilite: s.reliabilityScore,
        commandes: s.ordersCount,
        taux_probleme_pct: s.problemRate,
        dernier_contact: s.lastContactAt ?? "",
        tags: s.tags.join(", "),
      }));
      break;

    case "messages": {
      const prepared = desk.messages;
      payload = prepared;
      rows = prepared.map((m) => ({
        date: m.preparedAt,
        fournisseur: m.supplierName ?? "",
        commande: m.orderNumber ?? "",
        template: m.templateKey,
        statut: m.status,
        envoye_le: m.sentAt ?? "",
        reponse_le: m.replyAt ?? "",
      }));
      break;
    }

    case "products_resource": {
      const sourcing = dataset.products
        .map((p) => computeProductSourcing(p.id, p.priceMin, desk))
        .filter((s) => s.status === "a_sourcer" || s.status === "marge_faible" || s.status === "fournisseur_risque");
      payload = sourcing;
      rows = sourcing.map((s) => {
        const product = dataset.products.find((p) => p.id === s.productId);
        return {
          produit: product?.title ?? s.productId,
          prix_client: product?.priceMin ?? "",
          statut: SOURCING_STATUS_LABELS[s.status],
          fournisseur_actuel: s.currentSupplierName ?? "",
          cout_actuel: s.currentCost ?? "",
          marge_pct: s.marginPct ?? "",
          meilleur_prix_connu: s.bestHistoricalPrice ?? "",
          fournisseurs_connus: s.suppliersCount,
          commandes_liees: s.linkedOrdersCount,
        };
      });
      break;
    }

    case "anomalies":
      payload = dataset.anomalies;
      rows = dataset.anomalies.map((a) => ({
        type: a.type,
        severite: a.severity,
        titre: a.title,
        sessions_concernees: a.affectedSessions,
        ca_concerne: a.affectedRevenue ?? "",
        cause_probable: a.probableCause ?? "",
        action_recommandee: a.recommendedAction ?? "",
      }));
      break;

    case "sessions_suspect": {
      const suspect = dataset.sessions.filter((s) =>
        s.events.some((e) => e.status === "suspect" || e.status === "incomplete" || e.status === "out_of_period")
      );
      payload = suspect;
      rows = suspect.map((s) => ({
        session: s.id,
        date: s.startedAt,
        source: s.source ?? "",
        statut: s.status,
        fiabilite: s.reliabilityScore,
        evenements: s.events.length,
        statuts_evenements: [...new Set(s.events.map((e) => e.status))].join(", "),
      }));
      break;
    }

    case "activity":
      payload = desk.activities ?? [];
      rows = (desk.activities ?? []).map((a) => ({
        date: a.createdAt,
        entite: a.entityType,
        action: a.action,
        titre: a.title,
        description: a.description ?? "",
        acteur: a.actorType,
      }));
      break;

    case "diagnostic": {
      const [checks, health] = await Promise.all([runChecks(), computeDataHealth(dataset, (await getActiveDataset()).status)]);
      payload = { mode, healthScore: health.globalScore, components: health.components, checks };
      rows = checks.map((c) => ({ verification: c.name, statut: c.status, detail: c.detail }));
      break;
    }

    case "sessions":
    default:
      payload = dataset.sessions;
      rows = dataset.sessions.map((s) => ({
        session: s.id,
        date: s.startedAt,
        source: s.source ?? "",
        campagne: s.campaign ?? "",
        appareil: s.device,
        pays: s.country ?? "",
        statut: s.status,
        evenements: s.events.length,
        duree_s: s.durationSeconds ?? "",
      }));
      break;
  }

  if (format === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orkestra-${type}.csv"`,
      },
    });
  }

  return new NextResponse(
    JSON.stringify({ mode, exportedAt: new Date().toISOString(), [type]: payload }, null, 2),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="orkestra-${type}.json"`,
      },
    }
  );
}
