"use client";

import { useQuery } from "@tanstack/react-query";
import { CreditCard, FileBadge, FileText, Truck } from "lucide-react";
import { useState } from "react";
import { ResourcePage } from "@/components/resource/resource-page";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { EmptyState, StatCard } from "@/components/ui/primitives";
import { vendors } from "@/config/resources";
import type { Row } from "@/hooks/use-resource";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";

export default function VendorsPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ResourcePage
        config={vendors}
        headerActions={
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <FileBadge className="size-4" />
            1099 report
          </Button>
        }
        tabs={[
          { value: "all", label: "All" },
          { value: "owed", label: "We owe", filter: (v) => Number(v.amount_owed) > 0 },
          { value: "1099", label: "1099 vendors", filter: (v) => !!Number(v.is_1099) },
        ]}
      >
        {(rows) => (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Vendors" value={rows.length} hint={`${rows.filter((r) => Number(r.is_1099)).length} need a 1099`} icon={Truck} />
            <StatCard label="We owe" value={money(rows.reduce((s, r) => s + (Number(r.amount_owed) || 0), 0))} hint="Payable to vendors" icon={FileText} tone="danger" />
            <StatCard label="Credit left" value={money(rows.reduce((s, r) => s + (Number(r.balance_left_on_credit) || 0), 0))} hint="Across all vendor credit" icon={CreditCard} tone="info" />
          </div>
        )}
      </ResourcePage>
      <Report1099 open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** AC-03-03: what each 1099 vendor was paid in a year, ready to export for filing. */
function Report1099({ open, onClose }: { open: boolean; onClose: () => void }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "1099", year],
    queryFn: async () => (await api.get<{ year: number; total: number; vendors: Row[] }>("/reports/1099", { params: { year } })).data,
    enabled: open,
    retry: false,
  });
  const rows = data?.vendors || [];

  return (
    <Modal open={open} onClose={onClose} size="lg" title="1099 report" description="Payments made to vendors marked as 1099, for the selected year.">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="w-32">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
            {Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </Select>
        </div>
        <ExportMenu
          name={`1099-${year}`}
          title={`1099 Vendor Payments ${year}`}
          size="md"
          disabled={!rows.length}
          getData={() => ({
            headers: ["Contact", "Business", "Tax ID", "Email", "Phone", "Payments", "Total paid"],
            rows: rows.map((v) => [v.contact_name, v.business_name, v.tax_id, v.email, v.phone, Number(v.payments), Number(v.total_paid)]),
          })}
        />
      </div>
      {isLoading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-8" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState icon={FileBadge} title={error ? "Could not load the report" : "No 1099 vendors"} hint={error ? errorMessage(error) : 'Switch on "1099" for a vendor to include them here.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[11px] font-bold tracking-wider text-muted uppercase">
                <th className="h-10 px-6 text-left">Vendor</th>
                <th className="px-4 text-left">Tax ID</th>
                <th className="px-4 text-right">Payments</th>
                <th className="px-6 text-right">Total paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="px-6 py-3">
                    <p className="font-semibold">{v.contact_name}</p>
                    <p className="text-xs text-muted">{v.business_name || "-"}</p>
                  </td>
                  <td className="num px-4">{v.tax_id || "-"}</td>
                  <td className="num px-4 text-right">{v.payments}</td>
                  <td className="num px-6 text-right font-bold">{money(v.total_paid)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2">
                <td colSpan={3} className="px-6 py-3 text-sm font-bold">
                  Total for {year}
                </td>
                <td className="num px-6 text-right text-[15px] font-extrabold">{money(data?.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}
