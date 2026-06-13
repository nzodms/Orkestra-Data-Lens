"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

type DiagnosticCheck = { key: string; label: string; ok: boolean; detail: string };
type Diagnostic = {
  ok: boolean;
  environment: string;
  appUrl: string;
  checks: DiagnosticCheck[];
  missingTables: string[];
  lastMigration: string | null;
  pendingMigrations: string[];
};

/**
 * Bloc « Diagnostic serveur » : état env / DB / migrations en clair, bouton
 * d'application des migrations (protégé par MIGRATION_SECRET) et repli SQL à
 * coller dans Supabase. Le diagnostic initial vient du serveur ; le bouton
 * « Rafraîchir » re-interroge /api/system/diagnostic.
 */
export function ServerDiagnostic({
  initial,
  migrationsSql,
}: {
  initial: Diagnostic;
  migrationsSql: string;
}) {
  const [diag, setDiag] = useState<Diagnostic>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [showMigrate, setShowMigrate] = useState(false);
  const [secret, setSecret] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/system/diagnostic", { cache: "no-store" });
      setDiag((await res.json()) as Diagnostic);
    } catch {
      toast("Diagnostic injoignable.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const runMigrate = async () => {
    if (!secret.trim()) {
      setMigrateMsg({ ok: false, text: "Renseignez MIGRATION_SECRET." });
      return;
    }
    setMigrating(true);
    setMigrateMsg(null);
    try {
      const res = await fetch("/api/system/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim() }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        applied?: string[];
        skipped?: string[];
        error?: string;
      };
      if (res.ok && data.ok) {
        const n = data.applied?.length ?? 0;
        setMigrateMsg({
          ok: true,
          text:
            n > 0
              ? `${n} migration(s) appliquée(s) : ${data.applied!.join(", ")}.`
              : "Base déjà à jour — aucune migration en attente.",
        });
        setSecret("");
        await refresh();
      } else {
        setMigrateMsg({ ok: false, text: data.error ?? "Échec de la migration." });
      }
    } catch {
      setMigrateMsg({ ok: false, text: "Serveur injoignable." });
    } finally {
      setMigrating(false);
    }
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(migrationsSql);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 1500);
    } catch {
      // presse-papiers indisponible
    }
  };

  const inputCls =
    "w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[12.5px] shadow-sm outline-none focus:border-brand/50";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={diag.ok ? "green" : "red"}>
          {diag.ok ? "Serveur prêt" : "Configuration incomplète"}
        </Badge>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold shadow-sm hover:bg-white disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Rafraîchir
        </button>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {diag.checks.map((c) => (
          <div key={c.key} className="inset-panel flex items-start gap-2.5 px-3 py-2">
            {c.ok ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-positive" />
            ) : (
              <XCircle size={14} className="mt-0.5 shrink-0 text-critical" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold">{c.label}</div>
              <p className={cn("break-words text-[11px] leading-snug", c.ok ? "text-ink-soft" : "text-critical")}>
                {c.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Application des migrations sans terminal local */}
      {!diag.ok && diag.missingTables.length > 0 && (
        <div className="rounded-xl border border-warn/25 bg-warn-soft/50 p-3">
          <div className="text-[12px] font-semibold text-warn">
            {diag.missingTables.map((t) => `Migration manquante : table ${t} absente.`).join(" ")}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
            Appliquez les migrations sans terminal local : avec votre{" "}
            <code className="rounded bg-ink/5 px-1">MIGRATION_SECRET</code> (variable Vercel), ou en copiant le SQL
            dans Supabase → SQL Editor.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowMigrate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-strong"
        >
          <Play size={14} /> Appliquer les migrations
        </button>
        <button
          onClick={() => setShowSql((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold shadow-sm hover:bg-white"
        >
          <Database size={14} /> {showSql ? "Masquer" : "Afficher"} le SQL Supabase
        </button>
      </div>

      {showMigrate && (
        <div className="inset-panel space-y-2 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Application via MIGRATION_SECRET
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-soft">
            Définissez <code className="rounded bg-ink/5 px-1">MIGRATION_SECRET</code> dans les variables Vercel, puis
            collez-le ici. La route <code className="rounded bg-ink/5 px-1">/api/system/migrate</code> est inerte tant
            que ce secret n&apos;est pas configuré et ne s&apos;exécute qu&apos;en POST authentifié.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="MIGRATION_SECRET"
              autoComplete="off"
              className={cn(inputCls, "max-w-xs flex-1")}
            />
            <button
              onClick={runMigrate}
              disabled={migrating || !secret.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {migrating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Exécuter
            </button>
          </div>
          {migrateMsg && (
            <div
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium",
                migrateMsg.ok ? "bg-positive-soft text-positive" : "bg-critical-soft text-critical"
              )}
            >
              {migrateMsg.text}
            </div>
          )}
        </div>
      )}

      {showSql && (
        <div className="inset-panel space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              SQL à coller dans Supabase → SQL Editor
            </div>
            <button
              onClick={copySql}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink/10 bg-white/70 px-2 py-1.5 text-[11px] font-semibold shadow-sm hover:bg-white"
            >
              {sqlCopied ? <ClipboardCheck size={12} className="text-positive" /> : <Copy size={12} />}
              {sqlCopied ? "Copié" : "Copier"}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-lg bg-ink p-3 text-[10.5px] leading-relaxed text-gray-200">
            {migrationsSql}
          </pre>
          <p className="text-[11px] text-ink-soft">
            Le SQL est idempotent (<code className="rounded bg-ink/5 px-1">create table if not exists</code> /{" "}
            <code className="rounded bg-ink/5 px-1">add column if not exists</code>) — sans risque à rejouer.
          </p>
        </div>
      )}
    </div>
  );
}
