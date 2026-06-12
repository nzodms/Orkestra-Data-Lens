"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, Kanban, Rows3, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { OrderDrawer, statusTone } from "./OrderDrawer";
import { useDeskAction } from "./useDeskAction";
import { buildTodoList, ordersForFilterKey } from "@/lib/orderdesk/todo";
import type { DeskData, DeskOrder, OpsStatus } from "@/lib/orderdesk/types";
import {
  daysSince,
  estimatedMarginPct,
  isLate,
  KANBAN_COLUMNS,
  NEXT_ACTIONS,
  OPS_STATUS_LABELS,
  OPS_STATUS_ORDER,
} from "@/lib/orderdesk/types";
import { cn, formatDate, formatEUR } from "@/lib/utils";

export function OrdersWorkspace({ data, mode }: { data: DeskData; mode: "demo" | "live" }) {
  const { run, pending, error } = useDeskAction();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [statusFilter, setStatusFilter] = useState<"all" | OpsStatus>("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [todoFilter, setTodoFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const todos = useMemo(() => buildTodoList(data), [data]);
  const countries = useMemo(() => [...new Set(data.orders.map((o) => o.country).filter(Boolean))] as string[], [data.orders]);

  const filtered = useMemo(() => {
    let orders = todoFilter ? ordersForFilterKey(data.orders, todoFilter) : data.orders;
    if (statusFilter !== "all") orders = orders.filter((o) => o.opsStatus === statusFilter);
    if (supplierFilter === "none") orders = orders.filter((o) => !o.supplierId);
    else if (supplierFilter !== "all") orders = orders.filter((o) => o.supplierId === supplierFilter);
    if (countryFilter !== "all") orders = orders.filter((o) => o.country === countryFilter);
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.lineItems.some((li) => li.title.toLowerCase().includes(q))
      );
    }
    return orders;
  }, [data.orders, statusFilter, supplierFilter, countryFilter, search, todoFilter]);

  const selected = selectedId ? data.orders.find((o) => o.id === selectedId) ?? null : null;
  const selectCls =
    "rounded-xl border border-ink/10 bg-white/70 px-2.5 py-1.5 text-[12px] font-medium shadow-sm hover:bg-white";

  return (
    <div className="space-y-4">
      {/* À faire maintenant */}
      {todos.length > 0 && (
        <div className="card p-3.5 md:p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-critical-soft text-critical">
              <AlertTriangle size={13} strokeWidth={2.4} />
            </span>
            <h2 className="text-[13.5px] font-semibold tracking-tight">À faire maintenant</h2>
            {todoFilter && (
              <button
                onClick={() => setTodoFilter(null)}
                className="ml-auto rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-ink/10"
              >
                Réinitialiser le filtre ✕
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todos.map((t) => {
              const toneStyles = {
                red: "bg-critical-soft text-critical",
                orange: "bg-warn-soft text-warn",
                violet: "bg-ai-soft text-ai",
                blue: "bg-brand-soft text-brand-strong",
              }[t.tone];
              return (
                <button
                  key={t.id}
                  onClick={() => t.filterKey && setTodoFilter(todoFilter === t.filterKey ? null : t.filterKey)}
                  disabled={!t.filterKey}
                  className={cn(
                    "inset-panel flex items-start gap-2.5 p-2.5 text-left transition-all",
                    t.filterKey && "cursor-pointer hover:bg-white/70",
                    todoFilter === t.filterKey && "ring-2 ring-brand/40"
                  )}
                >
                  <span className={cn("num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold", toneStyles)}>
                    {t.count}
                  </span>
                  <span>
                    <span className="block text-[12px] font-semibold leading-snug">{t.label}</span>
                    <span className="block truncate text-[10.5px] text-ink-soft">{t.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtres + bascule vue */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="flex rounded-xl border border-ink/10 bg-white/60 p-0.5 shadow-sm">
          {(
            [
              { value: "kanban", label: "Kanban", icon: Kanban },
              { value: "table", label: "Table", icon: Rows3 },
            ] as const
          ).map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-all",
                view === v.value ? "bg-ink text-white shadow-sm" : "text-ink-soft hover:text-ink"
              )}
            >
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | OpsStatus)} className={selectCls}>
          <option value="all">Tous les statuts</option>
          {OPS_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {OPS_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className={selectCls}>
          <option value="all">Tous les fournisseurs</option>
          <option value="none">Non assigné</option>
          {data.suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className={selectCls}>
          <option value="all">Tous les pays</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Commande, produit…"
            className={cn(selectCls, "w-44 pl-7")}
          />
        </div>
        <span className="num text-[11.5px] text-ink-soft">{filtered.length} commande{filtered.length > 1 ? "s" : ""}</span>
      </div>

      {error && <p className="rounded-xl bg-critical-soft px-3 py-2 text-[12px] font-medium text-critical">{error}</p>}

      {/* Vue Kanban */}
      {view === "kanban" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
          <div className="flex gap-3" style={{ minWidth: KANBAN_COLUMNS.length * 240 }}>
            {KANBAN_COLUMNS.map((col) => {
              const colOrders = filtered.filter((o) => col.statuses.includes(o.opsStatus));
              return (
                <div key={col.key} className="w-60 shrink-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">{col.label}</span>
                    <span className="num rounded-full bg-ink/5 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-soft">
                      {colOrders.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {colOrders.map((order) => (
                      <KanbanCard
                        key={order.id}
                        order={order}
                        data={data}
                        onOpen={() => setSelectedId(order.id)}
                      />
                    ))}
                    {colOrders.length === 0 && (
                      <div className="rounded-xl border border-dashed border-ink/10 py-6 text-center text-[11px] text-ink-soft/60">
                        Aucune commande
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Vue Table */
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-[12px]">
              <thead>
                <tr className="border-b border-ink/5 text-left text-[10px] uppercase tracking-[0.08em] text-ink-soft">
                  <th className="px-4 py-3 font-semibold">Commande</th>
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Client</th>
                  <th className="px-3 py-3 font-semibold">Pays</th>
                  <th className="px-3 py-3 font-semibold">Produit</th>
                  <th className="px-3 py-3 text-right font-semibold">Prix client</th>
                  <th className="px-3 py-3 text-right font-semibold">Marge est.</th>
                  <th className="px-3 py-3 font-semibold">Fournisseur</th>
                  <th className="px-3 py-3 font-semibold">Statut</th>
                  <th className="px-3 py-3 font-semibold">Tracking</th>
                  <th className="px-4 py-3 font-semibold">Prochaine action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const supplier = order.supplierId ? data.suppliers.find((s) => s.id === order.supplierId) : undefined;
                  const margin = estimatedMarginPct(order, data.offers);
                  const late = isLate(order);
                  const line = order.lineItems[0];
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className="cursor-pointer border-b border-ink/[0.04] transition-colors last:border-0 hover:bg-white/70"
                    >
                      <td className="num whitespace-nowrap px-4 py-3 font-bold">
                        {order.orderNumber}
                        {late && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-critical">
                            <Clock3 size={10} /> retard
                          </span>
                        )}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-3">{formatDate(order.createdAt)}</td>
                      <td className="max-w-32 truncate px-3 py-3 text-ink-soft">{order.customerMasked ?? "—"}</td>
                      <td className="px-3 py-3">{order.country ?? "—"}</td>
                      <td className="max-w-48 truncate px-3 py-3 font-medium">
                        {line?.title ?? "—"}
                        {line && line.quantity > 1 && <span className="num text-ink-soft"> ×{line.quantity}</span>}
                        {order.lineItems.length > 1 && (
                          <span className="text-ink-soft"> +{order.lineItems.length - 1}</span>
                        )}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-3 text-right font-semibold">{formatEUR(order.totalPrice)}</td>
                      <td className={cn("num whitespace-nowrap px-3 py-3 text-right font-semibold",
                        margin == null ? "text-ink-soft" : margin >= 55 ? "text-positive" : margin >= 35 ? "text-warn" : "text-critical")}>
                        {margin != null ? `${margin} %` : "—"}
                      </td>
                      <td className="max-w-36 truncate px-3 py-3">
                        {supplier ? supplier.name : <span className="font-semibold text-critical">Non assigné</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Badge tone={statusTone(order.opsStatus)}>{OPS_STATUS_LABELS[order.opsStatus]}</Badge>
                      </td>
                      <td className="num max-w-36 truncate px-3 py-3 text-ink-soft">{order.trackingNumber ?? "—"}</td>
                      <td className="max-w-52 truncate px-4 py-3 text-[11.5px] text-ink-soft">{NEXT_ACTIONS[order.opsStatus]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer détail */}
      <OrderDrawer
        order={selected}
        data={data}
        mode={mode}
        onClose={() => setSelectedId(null)}
        runAction={run}
        pending={pending}
      />
    </div>
  );
}

function KanbanCard({ order, data, onOpen }: { order: DeskOrder; data: DeskData; onOpen: () => void }) {
  const supplier = order.supplierId ? data.suppliers.find((s) => s.id === order.supplierId) : undefined;
  const margin = estimatedMarginPct(order, data.offers);
  const late = isLate(order);
  const line = order.lineItems[0];
  const age = daysSince(order.createdAt);

  return (
    <button
      onClick={onOpen}
      className="card card-hover w-full p-3 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="num text-[12px] font-bold">{order.orderNumber}</span>
        <span className="num text-[10px] text-ink-soft">{age === 0 ? "aujourd'hui" : `J-${age}`}</span>
      </div>
      <div className="mt-1 truncate text-[12px] font-medium">
        {line?.title ?? "—"}
        {line && line.quantity > 1 && <span className="num text-ink-soft"> ×{line.quantity}</span>}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="num text-[13px] font-semibold">{formatEUR(order.totalPrice)}</span>
        {margin != null && (
          <span className={cn("num text-[11px] font-bold", margin >= 55 ? "text-positive" : margin >= 35 ? "text-warn" : "text-critical")}>
            {margin} %
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {supplier ? (
          <Badge tone="blue" className="max-w-36 truncate">{supplier.name}</Badge>
        ) : (
          <Badge tone="red">Non assigné</Badge>
        )}
        {late && (
          <Badge tone="red">
            <Clock3 size={10} /> Retard
          </Badge>
        )}
      </div>
      <div className="mt-2 border-t border-ink/5 pt-1.5 text-[10.5px] font-medium text-brand-strong">
        → {NEXT_ACTIONS[order.opsStatus]}
      </div>
    </button>
  );
}
