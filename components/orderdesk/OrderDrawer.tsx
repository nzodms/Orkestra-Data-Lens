"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageCircle,
  PackageCheck,
  Send,
  StickyNote,
  Truck,
  Users,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { compareForOrder } from "@/lib/orderdesk/compare";
import { fillTemplate, templateByKey, waLink, WHATSAPP_TEMPLATES } from "@/lib/orderdesk/templates";
import type { DeskAction } from "@/lib/orderdesk/actions";
import type { DeskData, DeskOrder, OpsStatus } from "@/lib/orderdesk/types";
import {
  estimatedMarginPct,
  MESSAGE_STATUS_LABELS,
  NEXT_ACTIONS,
  OPS_STATUS_LABELS,
  OPS_STATUS_ORDER,
} from "@/lib/orderdesk/types";
import { cn, formatDateTime, formatEUR } from "@/lib/utils";

const STATUS_TONES: Partial<Record<OpsStatus, BadgeTone>> = {
  todo: "red",
  sourcing: "orange",
  price_compare: "orange",
  supplier_chosen: "blue",
  message_sent: "blue",
  payment_pending: "violet",
  ordered: "blue",
  tracking_pending: "orange",
  shipped: "green",
  problem: "red",
  sav: "red",
};

export function statusTone(status: OpsStatus): BadgeTone {
  return STATUS_TONES[status] ?? "neutral";
}

export function OrderDrawer({
  order,
  data,
  mode,
  onClose,
  runAction,
  pending,
}: {
  order: DeskOrder | null;
  data: DeskData;
  mode: "demo" | "live";
  onClose: () => void;
  runAction: (action: DeskAction) => Promise<boolean>;
  pending: boolean;
}) {
  const [trackingInput, setTrackingInput] = useState("");
  const [problemInput, setProblemInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [templateKey, setTemplateKey] = useState("price_availability");
  const [messageSupplierId, setMessageSupplierId] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState<string | null>(null);
  const [multiMode, setMultiMode] = useState(false);
  const [multiSelection, setMultiSelection] = useState<Set<string>>(new Set());

  const comparison = useMemo(
    () => (order ? compareForOrder(order, data.suppliers, data.offers) : { rows: [], recommendation: null }),
    [order, data.suppliers, data.offers]
  );

  if (!order) return null;

  const supplier = order.supplierId ? data.suppliers.find((s) => s.id === order.supplierId) : undefined;
  const margin = estimatedMarginPct(order, data.offers);
  const orderMessages = data.messages.filter((m) => m.orderId === order.id);
  const orderNotes = data.notes.filter((n) => n.entityType === "order" && n.entityId === order.id);
  const line = order.lineItems[0];

  const templateVars = {
    product_name: line?.title ?? "—",
    variant: line?.variantTitle ?? "—",
    quantity: line?.quantity ?? 1,
    country: order.country ?? "—",
    product_reference:
      (line?.productId && data.offers.find((o) => o.productId === line.productId)?.productUrl) || line?.productId || "—",
    order_number: order.orderNumber,
    issue: order.problemNote ?? "—",
  };

  const defaultMsgSupplier =
    messageSupplierId ??
    order.supplierId ??
    comparison.rows.find((r) => r.flags.recommended)?.supplier.id ??
    data.suppliers[0]?.id ??
    null;
  const msgSupplier = data.suppliers.find((s) => s.id === defaultMsgSupplier);
  const currentBody = messageBody ?? fillTemplate(templateByKey(templateKey)?.body ?? "", templateVars);

  const sendToSupplier = async (supplierId: string, viaWhatsApp: boolean) => {
    const target = data.suppliers.find((s) => s.id === supplierId);
    if (!target) return;
    const body = fillTemplate(templateByKey(templateKey)?.body ?? "", templateVars);
    const link = waLink(target.whatsapp, viaWhatsApp ? currentBody : body);
    const ok = await runAction({
      type: "record_message",
      supplierId,
      orderId: order.id,
      templateKey,
      body: viaWhatsApp ? currentBody : body,
      status: viaWhatsApp && link ? "sent_manual" : "prepared",
    });
    if (ok && viaWhatsApp && link) window.open(link, "_blank", "noopener");
  };

  const quickActions: { label: string; icon: typeof CreditCard; action: DeskAction; show: boolean }[] = [
    {
      label: "Paiement fournisseur en attente",
      icon: CreditCard,
      action: { type: "set_status", orderId: order.id, status: "payment_pending" },
      show: !["payment_pending", "ordered", "shipped"].includes(order.opsStatus),
    },
    {
      label: "Commande fournisseur passée",
      icon: PackageCheck,
      action: { type: "set_status", orderId: order.id, status: "ordered" },
      show: !["ordered", "shipped"].includes(order.opsStatus),
    },
    {
      label: "Tracking en attente",
      icon: Truck,
      action: { type: "set_status", orderId: order.id, status: "tracking_pending" },
      show: order.opsStatus === "ordered",
    },
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Commande ${order.orderNumber}`}
      subtitle={`${formatDateTime(order.createdAt)} · ${order.customerMasked ?? "client masqué"} · ${order.country ?? "—"}`}
      badge={<Badge tone={statusTone(order.opsStatus)}>{OPS_STATUS_LABELS[order.opsStatus]}</Badge>}
      width="max-w-2xl"
    >
      <div className="space-y-4">
        {mode === "demo" && (
          <p className="rounded-xl bg-warn-soft/70 px-3 py-2 text-[11px] font-medium text-warn">
            Mode démo : les actions fonctionnent mais ne sont pas persistées (réinitialisées au redémarrage).
          </p>
        )}

        {/* Résumé Shopify */}
        <div className="inset-panel p-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-4">
            <Meta label="Total client" value={formatEUR(order.totalPrice)} strong />
            <Meta label="Paiement Shopify" value={order.financialStatus === "paid" ? "Payé" : order.financialStatus} />
            <Meta label="Fulfillment" value={order.fulfillmentStatus === "fulfilled" ? "Expédiée" : "Non expédiée"} />
            <Meta
              label="Marge estimée"
              value={margin != null ? `${margin} %` : "—"}
              strong
              tone={margin != null ? (margin >= 55 ? "text-positive" : margin >= 35 ? "text-warn" : "text-critical") : undefined}
            />
          </div>
          <div className="mt-3 space-y-1.5 border-t border-ink/5 pt-2.5">
            {order.lineItems.map((li, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="font-medium">
                  {li.title}
                  {li.variantTitle ? <span className="text-ink-soft"> — {li.variantTitle}</span> : null}
                </span>
                <span className="num whitespace-nowrap text-ink-soft">
                  ×{li.quantity} · {formatEUR(li.price * li.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Statut opérationnel + prochaine action */}
        <Section title="Statut opérationnel">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={order.opsStatus}
              onChange={(e) => runAction({ type: "set_status", orderId: order.id, status: e.target.value as OpsStatus })}
              disabled={pending}
              className="rounded-xl border border-ink/10 bg-white/80 px-2.5 py-1.5 text-[12px] font-medium shadow-sm"
            >
              {OPS_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {OPS_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            {pending && <Loader2 size={14} className="animate-spin text-ink-soft" />}
            <span className="text-[11.5px] text-ink-soft">
              Prochaine action : <span className="font-semibold text-ink">{NEXT_ACTIONS[order.opsStatus]}</span>
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {quickActions
              .filter((a) => a.show)
              .map((a) => (
                <button
                  key={a.label}
                  onClick={() => runAction(a.action)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1.5 text-[11.5px] font-semibold shadow-sm transition-colors hover:bg-white disabled:opacity-50"
                >
                  <a.icon size={13} /> {a.label}
                </button>
              ))}
          </div>
          {order.problemNote && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-critical-soft px-2.5 py-2 text-[11.5px] font-medium text-critical">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {order.problemNote}
            </p>
          )}
        </Section>

        {/* Fournisseur + comparaison */}
        <Section title="Fournisseur">
          {supplier ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <Badge tone="blue">{supplier.name}</Badge>
              <span className="text-ink-soft">
                Fiabilité <span className="num font-semibold text-ink">{supplier.reliabilityScore}/100</span>
                {order.supplierCost != null && (
                  <>
                    {" "}· Coût <span className="num font-semibold text-ink">{formatEUR(order.supplierCost)}</span>
                  </>
                )}
              </span>
            </div>
          ) : (
            <p className="text-[12px] text-ink-soft">Aucun fournisseur assigné pour l&apos;instant.</p>
          )}

          {comparison.rows.length > 0 ? (
            <div className="mt-3">
              {comparison.recommendation && (
                <p className="mb-2 flex items-start gap-2 rounded-xl bg-positive-soft/70 px-3 py-2 text-[12px] font-medium leading-relaxed text-positive">
                  <Award size={14} className="mt-0.5 shrink-0" /> {comparison.recommendation}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[11.5px]">
                  <thead>
                    <tr className="border-b border-ink/5 text-left text-[9.5px] uppercase tracking-[0.08em] text-ink-soft">
                      <th className="py-1.5 pr-2 font-semibold">Fournisseur</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Produit</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Livraison</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Total</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Délai</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Stock</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Fiab.</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Marge</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Score</th>
                      <th className="py-1.5 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.map((row) => (
                      <tr
                        key={row.offer.id}
                        className={cn(
                          "border-b border-ink/[0.04] last:border-0",
                          row.flags.recommended && "bg-positive-soft/40"
                        )}
                      >
                        <td className="py-2 pr-2">
                          <span className="font-semibold">{row.supplier.name}</span>
                          <span className="ml-1 inline-flex gap-1">
                            {row.flags.recommended && <Badge tone="green">Recommandé</Badge>}
                            {row.flags.bestPrice && !row.flags.recommended && <Badge tone="blue">Meilleur prix</Badge>}
                            {row.flags.bestLeadTime && <Badge tone="violet">Plus rapide</Badge>}
                            {row.flags.avoid && <Badge tone="red">À éviter</Badge>}
                          </span>
                        </td>
                        <td className="num py-2 pr-2 text-right">{formatEUR(row.offer.productPrice)}</td>
                        <td className="num py-2 pr-2 text-right">{formatEUR(row.offer.shippingPrice)}</td>
                        <td className="num py-2 pr-2 text-right font-semibold">{formatEUR(row.totalPrice)}</td>
                        <td className="num py-2 pr-2 text-right">{row.leadTimeDays != null ? `${row.leadTimeDays} j` : "—"}</td>
                        <td className="num py-2 pr-2 text-right">{row.stock ?? "—"}</td>
                        <td className="num py-2 pr-2 text-right">{row.reliability}</td>
                        <td className="num py-2 pr-2 text-right">
                          {row.estimatedMarginPct != null ? `${row.estimatedMarginPct} %` : "—"}
                        </td>
                        <td className="num py-2 pr-2 text-right font-bold">{row.score}</td>
                        <td className="py-2 text-right">
                          {order.supplierId === row.supplier.id ? (
                            <Badge tone="green">Choisi</Badge>
                          ) : (
                            <button
                              onClick={() =>
                                runAction({
                                  type: "assign_supplier",
                                  orderId: order.id,
                                  supplierId: row.supplier.id,
                                  cost: row.totalPrice,
                                })
                              }
                              disabled={pending}
                              className="rounded-lg bg-ink px-2 py-1 text-[10.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
                            >
                              Choisir
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[11.5px] text-ink-soft">
              Aucune offre fournisseur pour ce produit. Ajoutez des offres depuis la page Fournisseurs, ou envoyez une
              demande de prix ci-dessous.
            </p>
          )}
        </Section>

        {/* Message fournisseur (WhatsApp V1) */}
        <Section title="Message fournisseur" icon={<MessageCircle size={13} className="text-positive" />}>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={templateKey}
              onChange={(e) => {
                setTemplateKey(e.target.value);
                setMessageBody(null);
              }}
              className="rounded-xl border border-ink/10 bg-white/80 px-2.5 py-1.5 text-[12px] font-medium shadow-sm"
            >
              {WHATSAPP_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
            {!multiMode && (
              <select
                value={defaultMsgSupplier ?? ""}
                onChange={(e) => setMessageSupplierId(e.target.value)}
                className="rounded-xl border border-ink/10 bg-white/80 px-2.5 py-1.5 text-[12px] font-medium shadow-sm"
              >
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setMultiMode((m) => !m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11.5px] font-semibold shadow-sm transition-colors",
                multiMode ? "border-brand bg-brand-soft text-brand-strong" : "border-ink/10 bg-white/70 hover:bg-white"
              )}
            >
              <Users size={13} /> Multi-fournisseurs
            </button>
          </div>

          {multiMode ? (
            <div className="mt-2.5 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {data.suppliers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      setMultiSelection((sel) => {
                        const next = new Set(sel);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                      multiSelection.has(s.id)
                        ? "border-brand bg-brand-soft text-brand-strong"
                        : "border-ink/10 bg-white/60 text-ink-soft hover:bg-white"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-ink-soft">
                Un message individuel est généré par fournisseur — ouvrez WhatsApp pour chacun. Le statut (préparé,
                envoyé, réponse, prix, retenu) est suivi par fournisseur dans l&apos;onglet Messages.
              </p>
              <button
                onClick={async () => {
                  for (const supplierId of multiSelection) {
                    await sendToSupplier(supplierId, false);
                  }
                  setMultiSelection(new Set());
                }}
                disabled={pending || multiSelection.size === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
              >
                <Send size={13} /> Générer {multiSelection.size || ""} message{multiSelection.size > 1 ? "s" : ""}
              </button>
            </div>
          ) : (
            <>
              <textarea
                value={currentBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={6}
                className="mt-2.5 w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[12px] leading-relaxed shadow-sm"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => defaultMsgSupplier && sendToSupplier(defaultMsgSupplier, true)}
                  disabled={pending || !defaultMsgSupplier || !waLink(msgSupplier?.whatsapp, "x")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <ExternalLink size={13} /> Ouvrir WhatsApp
                </button>
                <button
                  onClick={() => defaultMsgSupplier && sendToSupplier(defaultMsgSupplier, false)}
                  disabled={pending || !defaultMsgSupplier}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3.5 py-2 text-[12px] font-semibold shadow-sm transition-colors hover:bg-white disabled:opacity-50"
                >
                  Préparer seulement
                </button>
                {msgSupplier && !waLink(msgSupplier.whatsapp, "x") && (
                  <span className="text-[11px] text-warn">Pas de numéro WhatsApp pour ce fournisseur.</span>
                )}
              </div>
            </>
          )}

          {orderMessages.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-ink/5 pt-2.5">
              {orderMessages.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-[11.5px]">
                  <Badge
                    tone={
                      m.status === "supplier_selected" || m.status === "price_filled"
                        ? "green"
                        : m.status === "reply_received"
                          ? "blue"
                          : m.status === "sent_manual"
                            ? "neutral"
                            : "orange"
                    }
                  >
                    {MESSAGE_STATUS_LABELS[m.status]}
                  </Badge>
                  <span className="font-medium">{m.supplierName}</span>
                  <span className="text-ink-soft">{templateByKey(m.templateKey)?.name ?? m.templateKey}</span>
                  <span className="num ml-auto whitespace-nowrap text-ink-soft">{formatDateTime(m.preparedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Tracking */}
        <Section title="Tracking" icon={<Truck size={13} className="text-brand" />}>
          {order.trackingNumber ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <Badge tone="green">
                <CheckCircle2 size={11} /> {order.trackingNumber}
              </Badge>
              {order.trackingCarrier && <span className="text-ink-soft">{order.trackingCarrier}</span>}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="Numéro de tracking…"
                className="flex-1 rounded-xl border border-ink/10 bg-white/80 px-3 py-1.5 text-[12px] shadow-sm"
              />
              <button
                onClick={async () => {
                  if (await runAction({ type: "set_tracking", orderId: order.id, tracking: trackingInput.trim() }))
                    setTrackingInput("");
                }}
                disabled={pending || trackingInput.trim().length < 3}
                className="rounded-xl bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
              >
                Ajouter & marquer expédiée
              </button>
            </div>
          )}
        </Section>

        {/* Problème */}
        {order.opsStatus !== "problem" && (
          <Section title="Signaler un problème" icon={<AlertTriangle size={13} className="text-critical" />}>
            <div className="flex flex-wrap gap-2">
              <input
                value={problemInput}
                onChange={(e) => setProblemInput(e.target.value)}
                placeholder="Décrire le problème fournisseur…"
                className="flex-1 rounded-xl border border-ink/10 bg-white/80 px-3 py-1.5 text-[12px] shadow-sm"
              />
              <button
                onClick={async () => {
                  if (await runAction({ type: "report_problem", orderId: order.id, note: problemInput.trim() }))
                    setProblemInput("");
                }}
                disabled={pending || problemInput.trim().length < 3}
                className="rounded-xl border border-critical/30 bg-critical-soft px-3.5 py-1.5 text-[12px] font-semibold text-critical transition-colors hover:bg-critical hover:text-white disabled:opacity-50"
              >
                Signaler
              </button>
            </div>
          </Section>
        )}

        {/* Notes internes */}
        <Section title="Notes internes" icon={<StickyNote size={13} className="text-warn" />}>
          {orderNotes.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {orderNotes.map((n) => (
                <div key={n.id} className="inset-panel px-3 py-2 text-[12px] leading-relaxed">
                  {n.body}
                  <span className="num ml-2 text-[10px] text-ink-soft">{formatDateTime(n.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Ajouter une note…"
              className="flex-1 rounded-xl border border-ink/10 bg-white/80 px-3 py-1.5 text-[12px] shadow-sm"
            />
            <button
              onClick={async () => {
                if (await runAction({ type: "add_note", entityType: "order", entityId: order.id, body: noteInput.trim() }))
                  setNoteInput("");
              }}
              disabled={pending || noteInput.trim().length === 0}
              className="rounded-xl border border-ink/10 bg-white/70 px-3.5 py-1.5 text-[12px] font-semibold shadow-sm transition-colors hover:bg-white disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        </Section>
      </div>
    </Drawer>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
        {icon} {title}
      </div>
      {children}
    </section>
  );
}

function Meta({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</div>
      <div className={cn("num text-[13px]", strong ? "font-semibold" : "font-medium", tone)}>{value}</div>
    </div>
  );
}
