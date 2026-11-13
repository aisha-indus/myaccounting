import { site } from "@/config/site";

export function getCurrency(): string {
  if (typeof window === "undefined") return site.currency;
  try {
    return localStorage.getItem("ibms_currency") || site.currency;
  } catch {
    return site.currency;
  }
}

export function money(value: unknown, opts: { compact?: boolean } = {}): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat(site.locale, {
    style: "currency",
    currency: getCurrency(),
    currencyDisplay: "narrowSymbol",
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 1 : 2,
  }).format(n);
}

export const number = (value: unknown) => new Intl.NumberFormat(site.locale).format(Number(value) || 0);

/** "2026-03-15" or "2026-03-15 10:00:00" -> "15 Mar 2026" (parsed as a plain date, no timezone shift). */
export function date(value: unknown): string {
  if (!value) return "-";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(value);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(value: unknown): string {
  if (!value) return "-";
  const s = String(value).replace("T", " ");
  return `${date(s)}, ${s.slice(11, 16)}`;
}

export const month = (value: unknown) => {
  if (!value) return "-";
  const [y, m] = String(value).split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

/** 135 -> "2h 15m" */
export function minutes(value: unknown): string {
  const n = Number(value) || 0;
  if (!n) return "-";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${isoDate()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
