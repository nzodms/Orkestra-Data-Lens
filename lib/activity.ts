// ─── Journal d'actions (activity log) — types partagés client/serveur ────────

export type ActivityEntityType = "order" | "supplier" | "product" | "tracking" | "anomaly" | "system";

export type ActivityLog = {
  id: string;
  shopId: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: string;
  title: string;
  description?: string;
  previousValue?: unknown;
  newValue?: unknown;
  actorType: "user" | "system";
  actorId?: string;
  createdAt: string;
};

export const ACTIVITY_ENTITY_LABELS: Record<ActivityEntityType, string> = {
  order: "Commande",
  supplier: "Fournisseur",
  product: "Produit",
  tracking: "Tracking",
  anomaly: "Anomalie",
  system: "Système",
};

// ─── Alertes opérationnelles ──────────────────────────────────────────────────

export type AlertCategory = "orderdesk" | "tracking" | "funnel" | "supplier" | "product";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "active" | "snoozed" | "resolved";

export type OperationalAlert = {
  /** Clé stable et déterministe : `type:entityId` — sert d'identifiant. */
  id: string;
  shopId: string;
  type: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  recommendedAction?: string;
  /** Lien du bouton d'action. */
  href?: string;
  entityType?: string;
  entityId?: string;
  status: AlertStatus;
  createdAt: string;
  resolvedAt?: string;
};

export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  orderdesk: "Order Desk",
  tracking: "Tracking",
  funnel: "Funnel",
  supplier: "Fournisseur",
  product: "Produit",
};

export type AlertState = { status: AlertStatus; snoozedUntil?: string };

/** Fusionne les alertes calculées avec leurs statuts persistés (snooze 24 h). */
export function mergeAlertStates(
  candidates: OperationalAlert[],
  states: Map<string, AlertState>
): OperationalAlert[] {
  const now = Date.now();
  return candidates.map((alert) => {
    const state = states.get(alert.id);
    if (!state) return alert;
    if (state.status === "snoozed" && state.snoozedUntil && new Date(state.snoozedUntil).getTime() < now) {
      return alert; // snooze expiré → redevient active
    }
    return { ...alert, status: state.status };
  });
}
