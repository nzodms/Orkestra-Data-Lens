"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useDeskAction } from "./useDeskAction";
import { templateByKey, waLink } from "@/lib/orderdesk/templates";
import type { DeskData, MessageStatus, SupplierMessage } from "@/lib/orderdesk/types";
import { MESSAGE_STATUS_LABELS } from "@/lib/orderdesk/types";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_FILTERS: { value: MessageStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "prepared", label: "Préparés" },
  { value: "sent_manual", label: "Envoyés" },
  { value: "reply_received", label: "Réponse reçue" },
  { value: "price_filled", label: "Prix renseigné" },
  { value: "supplier_selected", label: "Fournisseur retenu" },
];

export function MessagesWorkspace({ data, mode }: { data: DeskData; mode: "demo" | "live" }) {
  const { run, pending, error } = useDeskAction();
  const [filter, setFilter] = useState<MessageStatus | "all">("all");
  const [quoteFor, setQuoteFor] = useState<SupplierMessage | null>(null);
  const [quoteForm, setQuoteForm] = useState({ productPrice: "", shippingPrice: "", leadTimeDays: "" });

  const filtered = useMemo(
    () => data.messages.filter((m) => filter === "all" || m.status === filter),
    [data.messages, filter]
  );

  const statusTone = (s: MessageStatus) =>
    s === "supplier_selected" || s === "price_filled" ? "green" : s === "reply_received" ? "blue" : s === "sent_manual" ? "neutral" : "orange";

  const submitQuote = async () => {
    if (!quoteFor) return;
    const order = data.orders.find((o) => o.id === quoteFor.orderId);
    const productId = order?.lineItems[0]?.productId;
    const ok = await run({
      type: "add_quote",
      supplierId: quoteFor.supplierId,
      orderId: quoteFor.orderId,
      productId,
      productPrice: Number(quoteForm.productPrice) || 0,
      shippingPrice: Number(quoteForm.shippingPrice) || 0,
      leadTimeDays: quoteForm.leadTimeDays ? Number(quoteForm.leadTimeDays) : undefined,
      messageId: quoteFor.id,
    });
    if (ok) {
      setQuoteFor(null);
      setQuoteForm({ productPrice: "", shippingPrice: "", leadTimeDays: "" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="card flex items-start gap-3 p-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-positive-soft text-positive">
          <MessageCircle size={15} />
        </span>
        <p className="text-[12px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">WhatsApp V1 :</span> les messages sont générés depuis les commandes
          puis ouverts dans WhatsApp Web (wa.me) — aucun envoi automatique. Suivez ici chaque demande : préparée,
          envoyée manuellement, réponse reçue, prix renseigné, fournisseur retenu.
          {mode === "demo" && " Mode démo : historique d'exemple, actions non persistées."}
        </p>
      </div>

      {error && <p className="rounded-xl bg-critical-soft px-3 py-2 text-[12px] font-medium text-critical">{error}</p>}

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-all",
              filter === f.value ? "border-ink bg-ink text-white shadow-md" : "border-ink/10 bg-white/60 text-ink-soft hover:bg-white"
            )}
          >
            {f.label}
            <span className="num ml-1 opacity-60">
              {f.value === "all" ? data.messages.length : data.messages.filter((m) => m.status === f.value).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <MessageCircle size={20} className="text-ink-soft" />
          <p className="text-[13px] font-medium">Aucun message dans ce statut</p>
          <p className="text-[12px] text-ink-soft">Générez une demande fournisseur depuis une commande de l&apos;Order Desk.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const supplier = data.suppliers.find((s) => s.id === m.supplierId);
            const link = waLink(supplier?.whatsapp, m.body);
            return (
              <div key={m.id} className="card card-hover p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(m.status)}>{MESSAGE_STATUS_LABELS[m.status]}</Badge>
                  <span className="text-[12.5px] font-semibold">{m.supplierName ?? supplier?.name ?? "Fournisseur"}</span>
                  {m.orderNumber && <span className="num text-[12px] text-ink-soft">{m.orderNumber}</span>}
                  <span className="text-[11.5px] text-ink-soft">{templateByKey(m.templateKey)?.name ?? m.templateKey}</span>
                  <span className="num ml-auto text-[11px] text-ink-soft">{formatDateTime(m.preparedAt)}</span>
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-line text-[11.5px] leading-relaxed text-ink-soft">{m.body}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {link && (m.status === "prepared" || m.status === "sent_manual") && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (m.status === "prepared") run({ type: "update_message", messageId: m.id, status: "sent_manual" });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <ExternalLink size={12} /> {m.status === "prepared" ? "Ouvrir WhatsApp" : "Rouvrir WhatsApp"}
                    </a>
                  )}
                  {m.status === "sent_manual" && (
                    <ActionButton onClick={() => run({ type: "update_message", messageId: m.id, status: "reply_received" })} disabled={pending}>
                      Réponse reçue
                    </ActionButton>
                  )}
                  {(m.status === "reply_received" || m.status === "sent_manual") && (
                    <ActionButton onClick={() => { setQuoteFor(m); }} disabled={pending}>
                      Renseigner prix / délai
                    </ActionButton>
                  )}
                  {m.status === "price_filled" && (
                    <ActionButton
                      onClick={async () => {
                        await run({ type: "update_message", messageId: m.id, status: "supplier_selected" });
                        if (m.orderId) await run({ type: "assign_supplier", orderId: m.orderId, supplierId: m.supplierId });
                      }}
                      disabled={pending}
                      tone="green"
                    >
                      <CheckCircle2 size={12} /> Retenir ce fournisseur
                    </ActionButton>
                  )}
                </div>

                {/* Mini-formulaire devis */}
                {quoteFor?.id === m.id && (
                  <div className="fade-up mt-3 flex flex-wrap items-end gap-2 border-t border-ink/5 pt-3">
                    <QuoteField label="Prix produit (€)">
                      <input
                        type="number"
                        value={quoteForm.productPrice}
                        onChange={(e) => setQuoteForm({ ...quoteForm, productPrice: e.target.value })}
                        className="w-28 rounded-xl border border-ink/10 bg-white/80 px-2.5 py-1.5 text-[12px] shadow-sm"
                      />
                    </QuoteField>
                    <QuoteField label="Livraison (€)">
                      <input
                        type="number"
                        value={quoteForm.shippingPrice}
                        onChange={(e) => setQuoteForm({ ...quoteForm, shippingPrice: e.target.value })}
                        className="w-28 rounded-xl border border-ink/10 bg-white/80 px-2.5 py-1.5 text-[12px] shadow-sm"
                      />
                    </QuoteField>
                    <QuoteField label="Délai (jours)">
                      <input
                        type="number"
                        value={quoteForm.leadTimeDays}
                        onChange={(e) => setQuoteForm({ ...quoteForm, leadTimeDays: e.target.value })}
                        className="w-24 rounded-xl border border-ink/10 bg-white/80 px-2.5 py-1.5 text-[12px] shadow-sm"
                      />
                    </QuoteField>
                    <button
                      onClick={submitQuote}
                      disabled={pending || !quoteForm.productPrice}
                      className="rounded-xl bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-50"
                    >
                      Enregistrer le devis
                    </button>
                    <button onClick={() => setQuoteFor(null)} className="px-2 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink">
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "green";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold shadow-sm transition-colors disabled:opacity-50",
        tone === "green"
          ? "border-positive/25 bg-positive-soft text-positive hover:bg-positive hover:text-white"
          : "border-ink/10 bg-white/70 hover:bg-white"
      )}
    >
      {children}
    </button>
  );
}

function QuoteField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
