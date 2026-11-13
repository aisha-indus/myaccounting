"use client";

import { BookOpen, Plus, Scale, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { RowActionButtons, useResourceDialogs } from "@/components/resource/resource-page";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { Card, EmptyState, PageHeader, StatusBadge, Tabs } from "@/components/ui/primitives";
import { ACCOUNT_TYPES, ledgerAccounts } from "@/config/resources";
import { type Row, useList } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { date, money } from "@/lib/format";

const amount = (v: unknown) => (Number(v) ? <span className="num font-semibold">{money(v)}</span> : <span className="text-muted/50">-</span>);

/** AC-05-02: ledger summary grouped by category, with debit and credit balances. */
export default function LedgerAccountsPage() {
  const { data = [], isLoading, error } = useList("ledger-accounts");
  const { actions, dialogs, canWrite } = useResourceDialogs(ledgerAccounts);
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((a) => (type === "all" || a.account_type === type) && (!q || `${a.name} ${a.account_code} ${a.category} ${a.sub_type}`.toLowerCase().includes(q)));
  }, [data, type, search]);

  // Type -> category -> accounts, kept in chart-of-accounts order.
  const groups = useMemo(() => {
    return ACCOUNT_TYPES.map((t) => {
      const accounts = filtered.filter((a) => a.account_type === t);
      const categories = new Map<string, Row[]>();
      for (const a of accounts) categories.set(a.category || "Uncategorised", [...(categories.get(a.category || "Uncategorised") || []), a]);
      return { type: t, accounts, categories: [...categories.entries()] };
    }).filter((g) => g.accounts.length);
  }, [filtered]);

  const totalDebit = data.reduce((s, a) => s + Number(a.debit_balance), 0);
  const totalCredit = data.reduce((s, a) => s + Number(a.credit_balance), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005;

  const exportData = () => ({
    headers: ["Code", "Name", "Type", "Sub type", "Category", "Start date", "Debit balance", "Credit balance"],
    rows: filtered.map((a) => [a.account_code, a.name, a.account_type, a.sub_type, a.category, a.start_date, Number(a.debit_balance), Number(a.credit_balance)]),
  });

  return (
    <>
      <PageHeader
        title={ledgerAccounts.title}
        description={ledgerAccounts.description}
        actions={
          <>
            <ExportMenu name="ledger-summary" title="Ledger Summary" getData={exportData} disabled={!filtered.length} size="md" />
            {canWrite && (
              <Button onClick={actions.create}>
                <Plus className="size-4" />
                Add ledger account
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={type}
          onChange={setType}
          items={[{ value: "all", label: "All", count: data.length }, ...ACCOUNT_TYPES.map((t) => ({ value: t as string, label: t, count: data.filter((a) => a.account_type === t).length }))]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
            className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm shadow-card outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skeleton h-9" />
            ))}
          </div>
        ) : !groups.length ? (
          <EmptyState
            icon={BookOpen}
            title={error ? "Could not load data" : data.length ? "No matching accounts" : "No ledger accounts yet"}
            hint={error ? errorMessage(error) : data.length ? "Try another filter or search." : "Start with a Cash/Bank asset account, Accounts Receivable and Accounts Payable."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[11px] font-bold tracking-wider whitespace-nowrap text-muted uppercase">
                  <th className="h-11 px-5 text-left">Name</th>
                  <th className="px-4 text-left">No</th>
                  <th className="px-4 text-left">Sub type</th>
                  <th className="px-4 text-left">Start date</th>
                  <th className="px-4 text-right">Debit balance</th>
                  <th className="px-4 text-right">Credit balance</th>
                  <th className="w-px px-4" />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.type}>
                    <tr className="border-b border-line bg-surface">
                      <td colSpan={7} className="px-5 pt-5 pb-2">
                        <div className="flex items-center gap-3">
                          <StatusBadge value={group.type} />
                          <span className="text-xs text-muted">
                            {group.accounts.length} account{group.accounts.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.categories.map(([category, accounts]) => (
                      <Fragment key={category}>
                        <tr className="border-b border-line bg-surface-2/60">
                          <td colSpan={4} className="px-5 py-2 text-xs font-bold tracking-wide text-muted">
                            {category}
                          </td>
                          <td className="num px-4 py-2 text-right text-xs font-bold text-muted">{money(accounts.reduce((s, a) => s + Number(a.debit_balance), 0))}</td>
                          <td className="num px-4 py-2 text-right text-xs font-bold text-muted">{money(accounts.reduce((s, a) => s + Number(a.credit_balance), 0))}</td>
                          <td />
                        </tr>
                        {accounts.map((a) => (
                          <tr key={a.id} className="border-b border-line whitespace-nowrap transition-colors hover:bg-brand/[0.035]">
                            <td className="py-3 pr-4 pl-9 font-semibold">{a.name}</td>
                            <td className="num px-4 font-mono text-[13px] text-muted">{a.account_code}</td>
                            <td className="px-4 text-muted">{a.sub_type || "-"}</td>
                            <td className="num px-4 text-muted">{date(a.start_date)}</td>
                            <td className="px-4 text-right">{amount(a.debit_balance)}</td>
                            <td className="px-4 text-right">{amount(a.credit_balance)}</td>
                            <td className="px-4">
                              <RowActionButtons row={a} actions={actions} />
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              {type === "all" && !search && (
                <tfoot>
                  <tr className="bg-surface-2 whitespace-nowrap">
                    <td colSpan={4} className="px-5 py-4">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <Scale className="size-4 text-muted" />
                        Trial balance
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", balanced ? "bg-success/12 text-success" : "bg-danger/12 text-danger")}>
                          {balanced ? "Balanced" : `Out by ${money(Math.abs(totalDebit - totalCredit))}`}
                        </span>
                      </span>
                    </td>
                    <td className="num px-4 text-right text-[15px] font-extrabold">{money(totalDebit)}</td>
                    <td className="num px-4 text-right text-[15px] font-extrabold">{money(totalCredit)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>

      {dialogs}
    </>
  );
}
