"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { Input, Select } from "@/components/ui/form";
import { Card, EmptyState, PageHeader, Tabs } from "@/components/ui/primitives";
import { site } from "@/config/site";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { date, isoDate, money } from "@/lib/format";

type Report = "profit-loss" | "balance-sheet" | "cash-flow";
interface Group {
  name: string;
  total: number;
  accounts: { id: number; name: string; account_code: string; balance: number }[];
}

// AC-06-04: month, quarter, year or custom range
const PRESETS = ["This month", "This quarter", "This year", "Last year", "Custom"] as const;
function presetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "This month":
      return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) };
    case "This quarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: isoDate(new Date(y, q, 1)), to: isoDate(new Date(y, q + 3, 0)) };
    }
    case "Last year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report>("profit-loss");
  const [preset, setPreset] = useState<string>("This year");
  const [range, setRange] = useState(() => presetRange("This year"));

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", report, range.from, range.to],
    queryFn: async () => (await api.get(`/reports/${report}`, { params: range })).data,
    retry: false,
  });

  // Flat rows used for the CSV export of whichever statement is open.
  const csvRows = useMemo<[string, string | number][]>(() => {
    if (!data) return [];
    const groups = (title: string, list: Group[]) => [[title, ""] as [string, string], ...list.flatMap((g) => g.accounts.map((a) => [`  ${a.name}`, a.balance] as [string, number]))];
    if (report === "profit-loss") {
      return [...groups("Income", data.income), ["Total income", data.totalIncome], ...groups("Expenses", data.expense), ["Total expenses", data.totalExpense], ["Net profit / loss", data.netProfit]];
    }
    if (report === "balance-sheet") {
      return [
        ...groups("Assets", data.assets), ["Total assets", data.totalAssets],
        ...groups("Liabilities", data.liabilities), ["Total liabilities", data.totalLiabilities],
        ...groups("Equity", data.equity), ["Total equity", data.totalEquity],
        ["Liabilities + equity", data.liabilitiesAndEquity],
      ];
    }
    const flow = (title: string, list: { name: string; amount: number }[]) => [[title, ""] as [string, string], ...list.map((l) => [`  ${l.name}`, l.amount] as [string, number])];
    return [
      ["Starting balance", data.startingBalance],
      ...flow("Operating activities", data.operating), ["Total operating", data.totalOperating],
      ...flow("Investing activities", data.investing), ["Total investing", data.totalInvesting],
      ...flow("Financing activities", data.financing), ["Total financing", data.totalFinancing],
      ["Total cash flow", data.totalCashFlow],
      ["Ending balance", data.endingBalance],
    ];
  }, [data, report]);

  const titles: Record<Report, string> = { "profit-loss": "Profit and Loss", "balance-sheet": "Balance Sheet", "cash-flow": "Cash Flow Statement" };
  const period = report === "balance-sheet" ? `As of ${date(range.to)}` : `${date(range.from)} to ${date(range.to)}`;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Financial statements built from your journal entries."
        actions={
          <>
            <ExportMenu name={report} title={titles[report]} subtitle={period} getData={() => ({ headers: ["Account", "Amount"], rows: csvRows })} disabled={!data} size="md" />
            <Button variant="secondary" onClick={() => window.print()} disabled={!data}>
              <Printer className="size-4" />
              Print
            </Button>
          </>
        }
      />

      <div className="no-print mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={report}
          onChange={setReport}
          items={[
            { value: "profit-loss", label: "Profit and Loss" },
            { value: "balance-sheet", label: "Balance Sheet" },
            { value: "cash-flow", label: "Cash Flow" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <Select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                if (e.target.value !== "Custom") setRange(presetRange(e.target.value));
              }}
              aria-label="Period"
            >
              {PRESETS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Input type="date" value={range.from} max={range.to} aria-label="From" onChange={(e) => (setPreset("Custom"), setRange((r) => ({ ...r, from: e.target.value })))} />
          </div>
          <span className="text-sm text-muted">to</span>
          <div className="w-40">
            <Input type="date" value={range.to} min={range.from} aria-label="To" onChange={(e) => (setPreset("Custom"), setRange((r) => ({ ...r, to: e.target.value })))} />
          </div>
        </div>
      </div>

      <Card className="mx-auto max-w-4xl">
        <div className="border-b border-line px-6 py-6 text-center sm:px-10">
          <p className="text-xs font-bold tracking-[0.18em] text-muted uppercase">{site.fullName}</p>
          <h2 className="mt-1.5 text-xl font-extrabold tracking-tight">{titles[report]}</h2>
          <p className="mt-1 text-sm text-muted">{period}</p>
        </div>

        <div className="px-6 py-6 sm:px-10">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-7" />
              ))}
            </div>
          ) : error || !data ? (
            <EmptyState icon={TrendingDown} title="Could not load the report" hint={error ? errorMessage(error) : undefined} />
          ) : report === "profit-loss" ? (
            <>
              <Section title="Income" groups={data.income} total={data.totalIncome} totalLabel="Total income" />
              <Section title="Expenses" groups={data.expense} total={data.totalExpense} totalLabel="Total expenses" />
              <Grand label={data.netProfit >= 0 ? "Net profit" : "Net loss"} value={data.netProfit} tone={data.netProfit >= 0 ? "success" : "danger"} />
              <Compare current={data.netProfit} previous={data.previous} />
            </>
          ) : report === "balance-sheet" ? (
            <>
              <Section title="Asset accounts" groups={data.assets} total={data.totalAssets} totalLabel="Total assets" />
              <Section title="Liability accounts" groups={data.liabilities} total={data.totalLiabilities} totalLabel="Total liability" />
              <Section title="Equity accounts" groups={data.equity} total={data.totalEquity} totalLabel="Total equity" />
              <Grand label="Liability + equity" value={data.liabilitiesAndEquity} tone={data.balanced ? "success" : "danger"} />
              {data.balanced && (
                <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-success">
                  <Scale className="size-4" />
                  Balanced: total assets equal liabilities + equity ({money(data.totalAssets)}).
                </p>
              )}
              {!data.balanced && (
                <p className="mt-3 text-[13px] text-danger">
                  Assets and liabilities + equity differ by {money(Math.abs(data.totalAssets - data.liabilitiesAndEquity))}. Open Ledger Accounts and save any account to re-sync the opening balances.
                </p>
              )}
            </>
          ) : (
            <>
              <Line label="Starting balance" value={data.startingBalance} bold />
              <Flow title="Cash flow from operating activities" lines={data.operating} total={data.totalOperating} />
              <Flow title="Cash flow from investing activities" lines={data.investing} total={data.totalInvesting} />
              <Flow title="Cash flow from financing activities" lines={data.financing} total={data.totalFinancing} />
              <div className="mt-6 border-t border-line pt-3">
                <Line label="Total cash flow" value={data.totalCashFlow} bold />
              </div>
              <Grand label="Ending balance" value={data.endingBalance} tone="brand" />
            </>
          )}
        </div>
      </Card>
    </>
  );
}

function Line({ label, value, bold, indent }: { label: string; value: number; bold?: boolean; indent?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-sm", bold && "font-bold", indent && "pl-5")}>
      <span className={cn(!bold && "text-muted")}>{label}</span>
      <span className={cn("num", Number(value) < 0 && "text-danger")}>{money(value)}</span>
    </div>
  );
}

function Section({ title, groups, total, totalLabel }: { title: string; groups: Group[]; total: number; totalLabel: string }) {
  return (
    <section className="mb-7">
      <h3 className="mb-2 text-[11px] font-bold tracking-[0.16em] text-muted uppercase">{title}</h3>
      {!groups.length && <p className="py-1.5 text-sm text-muted">No accounts.</p>}
      {groups.map((g) => (
        <div key={g.name} className="mb-1">
          <Line label={g.name} value={g.total} bold />
          {g.accounts.map((a) => (
            <Line key={`${a.id}-${a.name}`} label={a.account_code ? `${a.account_code}  ${a.name}` : a.name} value={a.balance} indent />
          ))}
        </div>
      ))}
      <div className="mt-2 border-t border-line pt-1">
        <Line label={totalLabel} value={total} bold />
      </div>
    </section>
  );
}

function Flow({ title, lines, total }: { title: string; lines: { name: string; amount: number }[]; total: number }) {
  return (
    <section className="mt-6">
      <h3 className="mb-1 text-[11px] font-bold tracking-[0.16em] text-muted uppercase">{title}</h3>
      {!lines.length && <p className="py-1.5 pl-5 text-sm text-muted">No activity in this period.</p>}
      {lines.map((l) => (
        <Line key={l.name} label={l.name} value={l.amount} indent />
      ))}
      <div className="mt-1 border-t border-dashed border-line pt-1">
        <Line label="Net" value={total} bold />
      </div>
    </section>
  );
}

function Grand({ label, value, tone }: { label: string; value: number; tone: "success" | "danger" | "brand" }) {
  const tones = { success: "bg-success/10 text-success", danger: "bg-danger/10 text-danger", brand: "bg-brand/10 text-brand-text" };
  return (
    <div className={cn("mt-4 flex items-center justify-between rounded-xl px-5 py-4", tones[tone])}>
      <span className="text-sm font-bold">{label}</span>
      <span className="num text-xl font-extrabold">{money(value)}</span>
    </div>
  );
}

/** AC-06-06: current period against the period of the same length just before it. */
function Compare({ current, previous }: { current: number; previous: { from: string; to: string; totalIncome: number; totalExpense: number; netProfit: number } }) {
  const diff = current - previous.netProfit;
  const up = diff >= 0;
  return (
    <div className="mt-4 rounded-xl border border-line p-5">
      <p className="text-[11px] font-bold tracking-[0.16em] text-muted uppercase">Compared with previous period</p>
      <p className="mt-1 text-xs text-muted">
        {date(previous.from)} to {date(previous.to)}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-4">
        {[
          ["Income", previous.totalIncome],
          ["Expenses", previous.totalExpense],
          ["Net", previous.netProfit],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-xs text-muted">{label}</p>
            <p className="num mt-0.5 text-sm font-bold">{money(value)}</p>
          </div>
        ))}
        <div>
          <p className="text-xs text-muted">Change in net</p>
          <p className={cn("num mt-0.5 inline-flex items-center gap-1 text-sm font-bold", up ? "text-success" : "text-danger")}>
            {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            {up ? "+" : "-"}
            {money(Math.abs(diff))}
          </p>
        </div>
      </div>
    </div>
  );
}
