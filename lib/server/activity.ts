import "server-only";
import {
  getDemoAlertStates,
  logDemoActivity,
  setDemoAlertState,
} from "@/data/orderdeskDemo";
import type { ActivityLog, AlertState, OperationalAlert } from "@/lib/activity";
import { query } from "./db";
import { getAppStatus } from "./datasource";
import { getConnectedShop } from "./repo";

/** Journal d'actions + statuts d'alertes — mode démo (mémoire) ou live (SQL). */

export async function logActivity(entry: Omit<ActivityLog, "id" | "shopId" | "createdAt">): Promise<void> {
  const status = await getAppStatus();
  if (status.mode === "demo") {
    logDemoActivity(entry);
    return;
  }
  const shop = await getConnectedShop();
  if (!shop) return;
  try {
    await query(
      `insert into activity_logs (shop_id, entity_type, entity_id, action, title, description, previous_value, new_value, actor_type, actor_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        shop.id,
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.title,
        entry.description ?? null,
        entry.previousValue != null ? JSON.stringify(entry.previousValue) : null,
        entry.newValue != null ? JSON.stringify(entry.newValue) : null,
        entry.actorType,
        entry.actorId ?? null,
      ]
    );
  } catch (err) {
    console.error("[activity] Journalisation impossible :", err instanceof Error ? err.message : err);
  }
}

export async function getLiveActivities(shopId: string, limit = 300): Promise<ActivityLog[]> {
  const rows = await query<{
    id: string;
    entity_type: ActivityLog["entityType"];
    entity_id: string;
    action: string;
    title: string;
    description: string | null;
    previous_value: unknown;
    new_value: unknown;
    actor_type: ActivityLog["actorType"];
    actor_id: string | null;
    created_at: string;
  }>(`select * from activity_logs where shop_id = $1 order by created_at desc limit $2`, [shopId, limit]);
  return rows.map((r) => ({
    id: r.id,
    shopId,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    title: r.title,
    description: r.description ?? undefined,
    previousValue: r.previous_value ?? undefined,
    newValue: r.new_value ?? undefined,
    actorType: r.actor_type,
    actorId: r.actor_id ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

// ─── Statuts d'alertes ────────────────────────────────────────────────────────

export async function getAlertStates(): Promise<Map<string, AlertState>> {
  const status = await getAppStatus();
  if (status.mode === "demo") return getDemoAlertStates();
  const shop = await getConnectedShop();
  if (!shop) return new Map();
  const rows = await query<{ alert_key: string; status: AlertState["status"]; snoozed_until: string | null }>(
    `select alert_key, status, snoozed_until from operational_alerts where shop_id = $1`,
    [shop.id]
  );
  return new Map(
    rows.map((r) => [
      r.alert_key,
      { status: r.status, snoozedUntil: r.snoozed_until ? new Date(r.snoozed_until).toISOString() : undefined },
    ])
  );
}

export async function setAlertState(
  alert: Pick<OperationalAlert, "id" | "type" | "category" | "severity" | "title" | "description" | "recommendedAction" | "entityType" | "entityId">,
  newStatus: AlertState["status"],
  snoozeHours = 24
): Promise<void> {
  const status = await getAppStatus();
  const snoozedUntil =
    newStatus === "snoozed" ? new Date(Date.now() + snoozeHours * 3600 * 1000).toISOString() : undefined;

  if (status.mode === "demo") {
    setDemoAlertState(alert.id, { status: newStatus, snoozedUntil });
  } else {
    const shop = await getConnectedShop();
    if (!shop) return;
    await query(
      `insert into operational_alerts (shop_id, alert_key, type, category, severity, title, description, recommended_action, entity_type, entity_id, status, snoozed_until, resolved_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, case when $11 = 'resolved' then now() else null end)
       on conflict (shop_id, alert_key) do update set
         status = excluded.status,
         snoozed_until = excluded.snoozed_until,
         resolved_at = case when excluded.status = 'resolved' then now() else null end,
         updated_at = now()`,
      [
        shop.id,
        alert.id,
        alert.type,
        alert.category,
        alert.severity,
        alert.title,
        alert.description,
        alert.recommendedAction ?? null,
        alert.entityType ?? null,
        alert.entityId ?? null,
        newStatus,
        snoozedUntil ?? null,
      ]
    );
  }

  await logActivity({
    entityType: "anomaly",
    entityId: alert.id,
    action: `alert_${newStatus}`,
    title:
      newStatus === "resolved"
        ? `Alerte résolue : ${alert.title}`
        : newStatus === "snoozed"
          ? `Alerte snoozée ${snoozeHours} h : ${alert.title}`
          : `Alerte réactivée : ${alert.title}`,
    actorType: "user",
  });
}
