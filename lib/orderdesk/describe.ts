import type { ActivityLog } from "@/lib/activity";
import type { DeskAction } from "./actions";
import type { DeskData } from "./types";
import { OPS_STATUS_LABELS } from "./types";
import { templateByKey } from "./templates";

/**
 * Transforme une action Order Desk en entrée du journal d'actions.
 * Utilisé par la façade serveur pour les deux modes (démo et live).
 */
export function describeDeskAction(
  action: DeskAction,
  data: DeskData
): Omit<ActivityLog, "id" | "shopId" | "createdAt"> | null {
  const order = "orderId" in action && action.orderId ? data.orders.find((o) => o.id === action.orderId) : undefined;
  const orderRef = order?.orderNumber ?? ("orderId" in action ? action.orderId : undefined);
  const supplierName = (id?: string) => data.suppliers.find((s) => s.id === id)?.name ?? "fournisseur";

  switch (action.type) {
    case "set_status":
      return {
        entityType: "order",
        entityId: action.orderId,
        action: "status_changed",
        title: `${orderRef} → ${OPS_STATUS_LABELS[action.status]}`,
        description: order ? `Statut précédent : ${OPS_STATUS_LABELS[order.opsStatus]}` : undefined,
        previousValue: order?.opsStatus,
        newValue: action.status,
        actorType: "user",
      };
    case "assign_supplier":
      return {
        entityType: "order",
        entityId: action.orderId,
        action: "supplier_assigned",
        title: `${supplierName(action.supplierId)} assigné à ${orderRef}`,
        description: action.cost != null ? `Coût fournisseur : ${action.cost.toFixed(2)} €` : undefined,
        previousValue: order?.supplierId,
        newValue: action.supplierId,
        actorType: "user",
      };
    case "set_tracking":
      return {
        entityType: "tracking",
        entityId: action.orderId,
        action: "tracking_added",
        title: `Tracking ajouté sur ${orderRef}`,
        description: `${action.tracking}${action.carrier ? ` (${action.carrier})` : ""} — commande marquée expédiée`,
        newValue: action.tracking,
        actorType: "user",
      };
    case "report_problem":
      return {
        entityType: "order",
        entityId: action.orderId,
        action: "problem_reported",
        title: `Problème signalé sur ${orderRef}`,
        description: action.note,
        actorType: "user",
      };
    case "add_note":
      return {
        entityType: action.entityType === "product" ? "product" : action.entityType,
        entityId: action.entityId,
        action: "note_added",
        title: "Note interne ajoutée",
        description: action.body.slice(0, 200),
        actorType: "user",
      };
    case "record_message": {
      const tpl = templateByKey(action.templateKey)?.name ?? action.templateKey;
      return {
        entityType: "order",
        entityId: action.orderId ?? action.supplierId,
        action: action.status === "sent_manual" ? "message_sent" : "message_prepared",
        title: `${action.status === "sent_manual" ? "Message envoyé à" : "Message préparé pour"} ${supplierName(action.supplierId)}`,
        description: `${tpl}${orderRef ? ` · ${orderRef}` : ""}`,
        actorType: "user",
      };
    }
    case "update_message": {
      const msg = data.messages.find((m) => m.id === action.messageId);
      const labels: Record<string, string> = {
        sent_manual: "Message marqué envoyé manuellement",
        reply_received: "Réponse fournisseur reçue",
        price_filled: "Prix renseigné",
        supplier_selected: "Fournisseur retenu",
        prepared: "Message repassé en préparé",
      };
      return {
        entityType: "supplier",
        entityId: msg?.supplierId ?? action.messageId,
        action: `message_${action.status}`,
        title: `${labels[action.status]} — ${msg?.supplierName ?? "fournisseur"}`,
        description: msg?.orderNumber ? `Commande ${msg.orderNumber}` : undefined,
        actorType: "user",
      };
    }
    case "add_quote":
      return {
        entityType: "supplier",
        entityId: action.supplierId,
        action: "quote_received",
        title: `Prix reçu de ${supplierName(action.supplierId)}`,
        description: `${action.productPrice.toFixed(2)} € + ${action.shippingPrice.toFixed(2)} € livraison${
          action.leadTimeDays != null ? ` · ${action.leadTimeDays} j` : ""
        }${orderRef ? ` · ${orderRef}` : ""}`,
        newValue: { productPrice: action.productPrice, shippingPrice: action.shippingPrice },
        actorType: "user",
      };
    case "upsert_supplier":
      return {
        entityType: "supplier",
        entityId: action.supplier.id ?? action.supplier.name,
        action: action.supplier.id ? "supplier_updated" : "supplier_created",
        title: `Fournisseur ${action.supplier.id ? "modifié" : "créé"} : ${action.supplier.name}`,
        actorType: "user",
      };
    case "add_offer":
      return {
        entityType: "product",
        entityId: action.productId,
        action: "offer_added",
        title: `Offre ${supplierName(action.supplierId)} ajoutée`,
        description: `${action.productPrice.toFixed(2)} € + ${action.shippingPrice.toFixed(2)} € livraison`,
        actorType: "user",
      };
    default:
      return null;
  }
}
