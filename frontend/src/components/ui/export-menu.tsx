"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { site } from "@/config/site";
import { downloadCsv, isoDate } from "@/lib/format";
import { Button } from "./button";

export interface ExportData {
  headers: string[];
  rows: unknown[][];
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown) => (v === null || v === undefined ? "" : isNumber(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(v));

/** Real .xlsx file: bold header row, numbers stay numbers so they can be summed in Excel. */
async function exportExcel(name: string, { headers, rows }: ExportData) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const sheet = [
    headers.map((h) => ({ value: h, fontWeight: "bold" as const })),
    ...rows.map((r) => r.map((v) => (isNumber(v) ? { value: v, type: Number } : { value: v === null || v === undefined ? "" : String(v) }))),
  ];
  await writeExcelFile(sheet as never).toFile(`${name}-${isoDate()}.xlsx`);
}

/** PDF table with a title block. Landscape when there are many columns. */
async function exportPdf(name: string, title: string, subtitle: string | undefined, { headers, rows }: ExportData) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: headers.length > 6 ? "landscape" : "portrait", unit: "pt", format: "a4" });
  doc.setFontSize(9).setTextColor(110);
  doc.text(site.fullName, 40, 36);
  doc.setFontSize(16).setTextColor(20);
  doc.text(title, 40, 58);
  doc.setFontSize(9).setTextColor(110);
  doc.text(subtitle || `Generated ${isoDate()}`, 40, 74);
  const numeric = headers.map((_, i) => rows.some((r) => isNumber(r[i])));
  autoTable(doc, {
    startY: 90,
    head: [headers],
    body: rows.map((r) => r.map(text)),
    styles: { fontSize: headers.length > 9 ? 7 : 8.5, cellPadding: 5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 248, 250] },
    columnStyles: Object.fromEntries(numeric.map((n, i) => [i, { halign: n ? "right" : "left" }])),
    margin: { left: 40, right: 40 },
  });
  doc.save(`${name}-${isoDate()}.pdf`);
}

interface ExportMenuProps {
  /** File name without extension or date. */
  name: string;
  /** Heading printed on the PDF. */
  title: string;
  subtitle?: string;
  /** Called when the user picks a format, so the export always reflects what is on screen. */
  getData: () => ExportData;
  disabled?: boolean;
  size?: "sm" | "md";
}

/** Export button offering Excel, PDF and CSV (SRS AC-06-05, TM-04-07). */
export function ExportMenu({ name, title, subtitle, getData, disabled, size = "sm" }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const run = async (format: "xlsx" | "pdf" | "csv") => {
    setOpen(false);
    setBusy(true);
    try {
      const data = getData();
      if (format === "xlsx") await exportExcel(name, data);
      else if (format === "pdf") await exportPdf(name, title, subtitle, data);
      else downloadCsv(name, data.headers, data.rows);
    } catch {
      toast.error("The file could not be created. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const items = [
    { format: "xlsx" as const, label: "Excel (.xlsx)", icon: FileSpreadsheet },
    { format: "pdf" as const, label: "PDF", icon: FileText },
    { format: "csv" as const, label: "CSV", icon: FileType },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size={size} onClick={() => setOpen((v) => !v)} disabled={disabled} loading={busy} aria-expanded={open}>
        {!busy && <Download className="size-4" />}
        Export
        <ChevronDown className="size-3.5 opacity-60" />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-44 animate-pop rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          {items.map((item) => (
            <button key={item.format} type="button" onClick={() => run(item.format)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium hover:bg-fg/5">
              <item.icon className="size-4 text-muted" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
