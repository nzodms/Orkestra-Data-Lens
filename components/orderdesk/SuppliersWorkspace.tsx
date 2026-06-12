"use client";

import { useMemo, useState } from "react";
import { Globe, Mail, MessageCircle, Plus, StickyNote } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useDeskAction } from "./useDeskAction";
import { statusTone } from "./OrderDrawer";
import { waLink } from "@/lib/orderdesk/templates";
import type { DeskData, Supplier, SupplierTag } from "@/lib/orderdesk/types";
import { MESSAGE_STATUS_LABELS, OPS_STATUS_LABELS } from "@/lib/orderdesk/types";
import { cn, formatDate, formatDateTime, formatEUR } from "@/lib/utils";

const TAG_TONES: Record<SupplierTag, BadgeTone> = {
  rapide: "blue",
  fiable: "green",
  cher: "orange",
  "bon prix": "green",
  fragile: "orange",
  "à éviter": "red",
};

const ALL_TAGS: SupplierTag[] = ["rapide", "fiable", "cher", "bon prix", "fragile", "à éviter"];

type FormState = {
  id?: string;
  name: string;
  whatsapp: string;
  email: string;
  website: string;
  country: string;
  currency: string;
  avgLeadTimeDays: string;
  reliabilityScore: string;
  notes: string;
  tags: SupplierTag[];
};

const emptyForm: FormState = {
  name: "", whatsapp: "", email: "", website: "", country: "", currency: "USD",
  avgLeadTimeDays: "", reliabilityScore: "80", notes: "", tags: [],
};

export function SuppliersWorkspace({ data, mode }: { data: DeskData; mode: "demo" | "live" }) {
  const { run, pending, error } = useDeskAction();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const selected = selectedId ? data.suppliers.find((s) => s.id === selectedId) ?? null : null;

  const relatedOrders = useMemo(
    () => (selected ? data.orders.filter((o) => o.supplierId === selected.id) : []),
    [selected, data.orders]
  );
  const relatedOffers = useMemo(
    () => (selected ? data.offers.filter((o) => o.supplierId === selected.id) : []),
    [selected, data.offers]
  );
  const relatedMessages = useMemo(
    () => (selected ? data.messages.filter((m) => m.supplierId === selected.id) : []),
    [selected, data.messages]
  );
  const relatedQuotes = useMemo(
    () => (selected ? data.quotes.filter((q) => q.supplierId === selected.id) : []),
    [selected, data.quotes]
  );
  const supplierNotes = useMemo(
    () => (selected ? data.notes.filter((n) => n.entityType === "supplier" && n.entityId === selected.id) : []),
    [selected, data.notes]
  );

  const openEdit = (s?: Supplier) => {
    setForm(
      s
        ? {
            id: s.id,
            name: s.name,
            whatsapp: s.whatsapp ?? "",
            email: s.email ?? "",
            website: s.website ?? "",
            country: s.country ?? "",
            currency: s.currency,
            avgLeadTimeDays: s.avgLeadTimeDays != null ? String(s.avgLeadTimeDays) : "",
            reliabilityScore: String(s.reliabilityScore),
            notes: s.notes ?? "",
            tags: s.tags,
          }
        : { ...emptyForm }
    );
  };

  const submitForm = async () => {
    if (!form || form.name.trim().length === 0) return;
    const ok = await run({
      type: "upsert_supplier",
      supplier: {
        id: form.id,
        name: form.name.trim(),
        whatsapp: form.whatsapp.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        country: form.country.trim() || undefined,
        currency: form.currency.trim() || undefined,
        avgLeadTimeDays: form.avgLeadTimeDays ? Number(form.avgLeadTimeDays) : undefined,
        reliabilityScore: form.reliabilityScore ? Number(form.reliabilityScore) : undefined,
        notes: form.notes.trim() || undefined,
        tags: form.tags,
      },
    });
    if (ok) setForm(null);
  };

  const inputCls = "w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-1.5 text-[12px] shadow-sm";

  return (
    <div className="space-y-4">
      {mode === "demo" && (
        <p className="card px-3.5 py-2 text-[11.5px] font-medium text-warn">
          Mode démo : fournisseurs d&apos;exemple — les modifications fonctionnent mais ne sont pas persistées.
        </p>
      )}
      {error && <p className="rounded-xl bg-critical-soft px-3 py-2 text-[12px] font-medium text-critical">{error}</p>}

      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-ink/5 px-4 py-3">
          <h2 className="text-[13.5px] font-semibold tracking-tight">
            {data.suppliers.length} fournisseur{data.suppliers.length > 1 ? "s" : ""}
          </h2>
          <button
            onClick={() => openEdit()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            <Plus size={13} /> Ajouter un fournisseur
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[12px]">
            <thead>
              <tr className="border-b border-ink/5 text-left text-[10px] uppercase tracking-[0.08em] text-ink-soft">
                <th className="px-4 py-3 font-semibold">Fournisseur</th>
                <th className="px-3 py-3 font-semibold">Pays</th>
                <th className="px-3 py-3 font-semibold">Contact</th>
                <th className="px-3 py-3 text-right font-semibold">Délai moyen</th>
                <th className="px-3 py-3 font-semibold">Fiabilité</th>
                <th className="px-3 py-3 text-right font-semibold">Commandes</th>
                <th className="px-3 py-3 text-right font-semibold">Problèmes</th>
                <th className="px-3 py-3 font-semibold">Dernier contact</th>
                <th className="px-4 py-3 font-semibold">Tags</th>
              </tr>
            </thead>
            <tbody>
              {data.suppliers.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className="cursor-pointer border-b border-ink/[0.04] transition-colors last:border-0 hover:bg-white/70"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-[10.5px] text-ink-soft">{s.currency}</div>
                  </td>
                  <td className="px-3 py-3">{s.country ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-2 text-ink-soft">
                      {s.whatsapp && <MessageCircle size={13} className="text-positive" />}
                      {s.email && <Mail size={13} />}
                      {s.website && <Globe size={13} />}
                    </span>
                  </td>
                  <td className="num px-3 py-3 text-right">{s.avgLeadTimeDays != null ? `${s.avgLeadTimeDays} j` : "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <ProgressBar
                        value={s.reliabilityScore}
                        color={s.reliabilityScore >= 85 ? "var(--color-positive)" : s.reliabilityScore >= 65 ? "var(--color-warn)" : "var(--color-critical)"}
                        height={5}
                        className="w-14"
                      />
                      <span className="num text-[10.5px] font-semibold">{s.reliabilityScore}</span>
                    </div>
                  </td>
                  <td className="num px-3 py-3 text-right">{s.ordersCount}</td>
                  <td className={cn("num px-3 py-3 text-right", s.problemRate > 8 ? "font-semibold text-critical" : "text-ink-soft")}>
                    {s.problemRate}%
                  </td>
                  <td className="num whitespace-nowrap px-3 py-3 text-ink-soft">
                    {s.lastContactAt ? formatDate(s.lastContactAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {s.tags.map((t) => (
                        <Badge key={t} tone={TAG_TONES[t]}>{t}</Badge>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fiche fournisseur */}
      <Drawer
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? ""}
        subtitle={selected ? `${selected.country ?? "—"} · ${selected.currency} · délai moyen ${selected.avgLeadTimeDays ?? "—"} j` : undefined}
        badge={
          selected && (
            <span className="flex gap-1">
              {selected.tags.map((t) => (
                <Badge key={t} tone={TAG_TONES[t]}>{t}</Badge>
              ))}
            </span>
          )
        }
        width="max-w-2xl"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <MiniStat label="Score fournisseur" value={`${selected.reliabilityScore}/100`} />
              <MiniStat label="Commandes" value={String(selected.ordersCount)} />
              <MiniStat label="Taux de problème" value={`${selected.problemRate}%`} />
              <MiniStat label="Dernier contact" value={selected.lastContactAt ? formatDate(selected.lastContactAt) : "—"} />
            </div>

            <div className="flex flex-wrap gap-2">
              {selected.whatsapp && (
                <a
                  href={waLink(selected.whatsapp, "Bonjour,") ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <MessageCircle size={13} /> WhatsApp · {selected.whatsapp}
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold shadow-sm hover:bg-white">
                  <Mail size={13} /> {selected.email}
                </a>
              )}
              {selected.website && (
                <a href={selected.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold shadow-sm hover:bg-white">
                  <Globe size={13} /> Site
                </a>
              )}
              <button
                onClick={() => openEdit(selected)}
                className="ml-auto rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold shadow-sm hover:bg-white"
              >
                Modifier
              </button>
            </div>

            {selected.notes && <p className="inset-panel px-3 py-2 text-[12px] leading-relaxed text-ink-soft">{selected.notes}</p>}

            {/* Produits associés (offres) */}
            <section>
              <SectionTitle>Produits associés ({relatedOffers.length})</SectionTitle>
              {relatedOffers.length === 0 ? (
                <p className="text-[11.5px] text-ink-soft">Aucune offre produit enregistrée.</p>
              ) : (
                <div className="space-y-1.5">
                  {relatedOffers.map((o) => (
                    <div key={o.id} className="inset-panel flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-[12px]">
                      <span className="font-semibold">{o.productTitle ?? o.productId}</span>
                      {o.preferred && <Badge tone="green">Préféré</Badge>}
                      <span className="num ml-auto whitespace-nowrap text-ink-soft">
                        {formatEUR(o.productPrice)} + {formatEUR(o.shippingPrice)} livr. · {o.leadTimeDays ?? "—"} j · MOQ {o.moq}
                        {o.stock != null && ` · stock ${o.stock}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Commandes liées */}
            <section>
              <SectionTitle>Commandes liées ({relatedOrders.length})</SectionTitle>
              {relatedOrders.length === 0 ? (
                <p className="text-[11.5px] text-ink-soft">Aucune commande assignée à ce fournisseur.</p>
              ) : (
                <div className="space-y-1.5">
                  {relatedOrders.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="num font-bold">{o.orderNumber}</span>
                      <span className="truncate text-ink-soft">{o.lineItems[0]?.title}</span>
                      <Badge tone={statusTone(o.opsStatus)}>{OPS_STATUS_LABELS[o.opsStatus]}</Badge>
                      <span className="num ml-auto">{formatEUR(o.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Prix proposés / délais constatés */}
            {relatedQuotes.length > 0 && (
              <section>
                <SectionTitle>Prix proposés ({relatedQuotes.length})</SectionTitle>
                <div className="space-y-1.5">
                  {relatedQuotes.map((q) => (
                    <div key={q.id} className="inset-panel flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-[12px]">
                      <span className="font-medium">{q.productId ?? "Produit"}</span>
                      <span className="num ml-auto text-ink-soft">
                        {formatEUR(q.productPrice)} + {formatEUR(q.shippingPrice)} · {q.leadTimeDays ?? "—"} j
                        {q.receivedAt && ` · reçu le ${formatDate(q.receivedAt)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Messages */}
            {relatedMessages.length > 0 && (
              <section>
                <SectionTitle>Messages envoyés ({relatedMessages.length})</SectionTitle>
                <div className="space-y-1.5">
                  {relatedMessages.slice(0, 6).map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-[11.5px]">
                      <Badge tone={m.status === "price_filled" || m.status === "supplier_selected" ? "green" : m.status === "reply_received" ? "blue" : "neutral"}>
                        {MESSAGE_STATUS_LABELS[m.status]}
                      </Badge>
                      {m.orderNumber && <span className="num font-semibold">{m.orderNumber}</span>}
                      <span className="num ml-auto text-ink-soft">{formatDateTime(m.preparedAt)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Notes internes */}
            <section>
              <SectionTitle>
                <StickyNote size={12} className="mr-1 inline text-warn" />
                Notes internes
              </SectionTitle>
              {supplierNotes.map((n) => (
                <div key={n.id} className="inset-panel mb-1.5 px-3 py-2 text-[12px] leading-relaxed">
                  {n.body}
                  <span className="num ml-2 text-[10px] text-ink-soft">{formatDate(n.createdAt)}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Ajouter une note…"
                  className={inputCls}
                />
                <button
                  onClick={async () => {
                    if (await run({ type: "add_note", entityType: "supplier", entityId: selected.id, body: noteInput.trim() }))
                      setNoteInput("");
                  }}
                  disabled={pending || noteInput.trim().length === 0}
                  className="shrink-0 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold shadow-sm hover:bg-white disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
            </section>
          </div>
        )}
      </Drawer>

      {/* Formulaire ajout / édition */}
      <Drawer
        open={form != null}
        onClose={() => setForm(null)}
        title={form?.id ? "Modifier le fournisseur" : "Nouveau fournisseur"}
      >
        {form && (
          <div className="space-y-3">
            <Field label="Nom *">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Shenzhen LightPro" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp">
                <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={inputCls} placeholder="+86 138 0013 8000" />
              </Field>
              <Field label="Email">
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Site web">
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Pays">
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inputCls} placeholder="CN" />
              </Field>
              <Field label="Devise">
                <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Délai moyen (jours)">
                <input type="number" value={form.avgLeadTimeDays} onChange={(e) => setForm({ ...form, avgLeadTimeDays: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Fiabilité (0-100)">
                <input type="number" value={form.reliabilityScore} onChange={(e) => setForm({ ...form, reliabilityScore: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Tags">
              <div className="flex flex-wrap gap-1.5">
                {ALL_TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setForm({
                        ...form,
                        tags: form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t],
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                      form.tags.includes(t) ? "border-brand bg-brand-soft text-brand-strong" : "border-ink/10 bg-white/60 text-ink-soft hover:bg-white"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Notes">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={inputCls} />
            </Field>
            <button
              onClick={submitForm}
              disabled={pending || form.name.trim().length === 0}
              className="w-full rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              {form.id ? "Enregistrer" : "Créer le fournisseur"}
            </button>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{children}</div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="inset-panel p-2.5 text-center">
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</div>
      <div className="num mt-0.5 text-[14px] font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
