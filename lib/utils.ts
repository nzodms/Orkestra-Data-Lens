import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// ─── Formatage ────────────────────────────────────────────────────────────────

export function formatEUR(value: number, opts?: { decimals?: number }) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts?.decimals ?? (value % 1 === 0 ? 0 : 2),
    maximumFractionDigits: opts?.decimals ?? 2,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function formatPct(value: number, decimals = 1) {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}%`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTimeShort(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

export function formatDateTime(iso: string) {
  return `${formatDate(iso)} · ${formatTimeShort(iso)}`;
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}min ${s}s` : `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

// ─── Dates / périodes ────────────────────────────────────────────────────────

/** Début du jour local pour un décalage de N jours dans le passé. */
export function startOfDayOffset(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d;
}

/** Construit un ISO string pour « il y a `dayOffset` jours à HH:MM:SS ». */
export function at(dayOffset: number, time: string): string {
  const [h, m, s] = time.split(":").map(Number);
  const d = startOfDayOffset(dayOffset);
  d.setHours(h, m ?? 0, s ?? 0, 0);
  return d.toISOString();
}

export function dayOffsetOf(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = startOfDayOffset(0);
  return Math.round((today.getTime() - d.getTime()) / 86400000);
}

// ─── Générateur pseudo-aléatoire déterministe (mock data stable) ─────────────

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T>(rng: () => number, items: [T, number][]): T {
  const total = items.reduce((acc, [, w]) => acc + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

export function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}
