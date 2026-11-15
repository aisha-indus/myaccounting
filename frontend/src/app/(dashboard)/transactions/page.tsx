"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowUpRight, Clock3, Hourglass } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatCell } from "@/components/resource/cells";
import { ResourceForm, toPayload } from "@/components/resource/resource-form";
import { RowActionButtons } from "@/components/resource/resource-page";
import type { Field } from "@/components/resource/types";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmDelete, Modal } from "@/components/ui/modal";
import { PageHeader, StatCard, StatusBadge, Tabs } from "@/components/ui/primitives";
import { type Row, useList, useRemove, useSave } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isoDate, money } from "@/lib/format";

type TxType = "money_in" | "money_out";
const partyLabel = (r: Row) => (r.business_name ? `${r.business_name} (${r.contact_name})` : r.contact_name);
/** Pending part: total minus what is paid now. Without a total, nothing is left for later. */
const laterOf = (v: Row) => {
  const total = Number(v.total_amount);
  if (!v.total_amount && v.total_amount !== 0) return 0;
  return Math.round((total - (Number(v.amount_now) || 0)) * 100) / 100;
};
const accountLabel = (a: Row) => `${a.account_code} - ${a.name} (${a.account_type})`;

// AC-04-01 / AC-04-02. AC-04-06: Money In posts to an Asset or Income account, Money Out to Expense or Liability.
const FORMS: Record<TxType, { title: string; description: string; fields: Field[] }> = {
  money_in: {
    title: "Money In",
    description: "Record money received from a customer.",
    fields: [
      { name: "date", label: "Date", type: "date", required: true },
      { name: "customer_id", label: "Coming from", type: "relation", required: true, relation: { resource: "customers", label: partyLabel } },
      { name: "for_what", label: "For what", type: "text", wide: true, placeholder: "e.g. Consulting fee" },
      {
        name: "ledger_account_id",
        label: "Select an account",
        type: "relation",
        required: true,
        wide: true,
        relation: { resource: "ledger-accounts", label: accountLabel, filter: (a) => ["Asset", "Income"].includes(a.account_type) },
        help: "Income for a new sale. Choose Accounts Receivable when the customer is paying an amount they already owe.",
      },
      {
        name: "total_amount",
        label: "Total amount",
        type: "money",
        virtual: true,
        initial: (r) => (Number(r.amount_now) || 0) + (Number(r.amount_later) || 0),
        help: "The full bill. Leave empty if it is all received now.",
      },
      { name: "amount_now", label: "Amount to come in now", type: "money" },
      { name: "amount_later", label: "Amount to come later", type: "money", computed: laterOf, minMessage: "The amount now is more than the total.", help: "Worked out for you. Stays as receivable from the customer." },
    ],
  },
  money_out: {
    title: "Money Out",
    description: "Record money paid to a vendor.",
    fields: [
      { name: "date", label: "Date", type: "date", required: true },
      { name: "vendor_id", label: "Going to", type: "relation", required: true, relation: { resource: "vendors", label: partyLabel } },
      { name: "for_what", label: "For what", type: "text", wide: true, placeholder: "e.g. Office supplies" },
      {
        name: "ledger_account_id",
        label: "Select an account",
        type: "relation",
        required: true,
        wide: true,
        relation: { resource: "ledger-accounts", label: accountLabel, filter: (a) => ["Expense", "Liability"].includes(a.account_type) },
        help: "Expense for a new bill. Choose Accounts Payable when you are paying an amount you already owe the vendor.",
      },
      {
        name: "total_amount",
        label: "Total amount",
        type: "money",
        virtual: true,
        initial: (r) => (Number(r.amount_now) || 0) + (Number(r.amount_later) || 0),
        help: "The full bill. Leave empty if it is all paid now.",
      },
      { name: "amount_now", label: "Amount going now", type: "money" },
      { name: "amount_later", label: "Amount to go later", type: "money", computed: laterOf, minMessage: "The amount now is more than the total.", help: "Worked out for you. Stays as payable to the vendor." },
    ],
  },
};

const summary = (v: Row) => {
  const now = Number(v.amount_now) || 0;
  const later = Number(v.amount_later) || 0;
  return [
    { label: "Now", value: money(now) },
    { label: "Later", value: money(later) },
    { label: "Total", value: money(now + later), strong: true },
  ];
};

export default function TransactionsPage() {
  const { canEdit } = useAuth();
  const canWrite = canEdit("transactions");
  const { data = [], isLoading, error } = useList("transactions");
  const save = useSave("transactions");
  const remove = useRemove("transactions");

  const [tab, setTab] = useState<"all" | TxType>("all");
  const [form, setForm] = useState<{ type: TxType; row?: Row } | null>(null);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<Row | null>(null);

  const rows = useMemo(() => (tab === "all" ? data : data.filter((t) => t.type === tab)), [data, tab]);
  const total = (type: TxType, key: string) => data.filter((t) => t.type === type).reduce((s, t) => s + (Number(t[key]) || 0), 0);

  const closeForm = () => {
    setForm(null);
    setFormError("");
  };

  const columns = useMemo<ColumnDef<Row, any>[]>(() => {
    const col = (id: string, header: string, cell: (r: Row) => React.ReactNode, align: "left" | "right" = "left"): ColumnDef<Row, any> => ({
      id,
      accessorFn: (r) => r[id],
      header,
      cell: ({ row }) => cell(row.original),
      meta: { label: header, align },
    });
    return [
      col("type", "Type", (r) => <StatusBadge value={r.type} />),
      col("date", "Date", (r) => formatCell("date", r.date)),
      col("party_name", "Name", (r) => <span className="font-semibold">{r.party_name}</span>),
      col("for_what", "For what", (r) => formatCell("text", r.for_what)),
      col("ledger_account_name", "Account", (r) => formatCell("text", r.ledger_account_name)),
      col(
        "amount_now",
        "Paid / Received",
        (r) => (
          <span className={`num font-bold ${r.type === "money_in" ? "text-success" : "text-danger"}`}>
            {r.type === "money_in" ? "+" : "-"}
            {money(r.amount_now)}
          </span>
        ),
        "right"
      ),
      col("amount_later", "Payable / Receivable", (r) => (Number(r.amount_later) ? formatCell("money", r.amount_later) : <span className="text-muted/50">-</span>), "right"),
      col("status", "Status", (r) => <StatusBadge value={r.status} />),
      {
        id: "_actions",
        header: "",
        enableSorting: false,
        enableGlobalFilter: false,
        meta: { utility: true, align: "right" },
        cell: ({ row }) =>
          // No customer and no vendor = posted automatically by payroll; it is changed from the Pay Sheet.
          row.original.customer_id === null && row.original.vendor_id === null ? (
            <span className="text-xs font-semibold text-muted" title="Posted automatically from the Pay Sheet">
              Payroll
            </span>
          ) : (
          <RowActionButtons
            row={row.original}
            noView
            actions={{ view: () => {}, edit: (r) => setForm({ type: r.type, row: r }), remove: setDeleting, canWrite }}
          />
          ),
      },
    ];
  }, [canWrite]);

  const active = form ? FORMS[form.type] : null;

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Money in from customers and money out to vendors. Each one posts balanced journal entries automatically."
        actions={
          canWrite && (
            <>
              <Button variant="secondary" onClick={() => setForm({ type: "money_out" })}>
                <ArrowUpRight className="size-4 text-danger" />
                Money Out
              </Button>
              <Button onClick={() => setForm({ type: "money_in" })}>
                <ArrowDownLeft className="size-4" />
                Money In
              </Button>
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Received" value={money(total("money_in", "amount_now"))} hint="Money in, paid now" icon={ArrowDownLeft} tone="success" />
        <StatCard label="Paid" value={money(total("money_out", "amount_now"))} hint="Money out, paid now" icon={ArrowUpRight} tone="danger" />
        <StatCard label="Receivable" value={money(total("money_in", "amount_later"))} hint="Still to come in" icon={Hourglass} tone="info" />
        <StatCard label="Payable" value={money(total("money_out", "amount_later"))} hint="Still to go out" icon={Clock3} tone="warning" />
      </div>

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: "All", count: data.length },
            { value: "money_in", label: "Money In", count: data.filter((t) => t.type === "money_in").length },
            { value: "money_out", label: "Money Out", count: data.filter((t) => t.type === "money_out").length },
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error ? errorMessage(error) : undefined}
        searchPlaceholder="Search transactions..."
        exportName="transactions"
        exportTitle="Transactions"
        emptyTitle="No transactions yet"
        emptyHint={canWrite ? "Record your first Money In or Money Out." : undefined}
      />

      <Modal open={!!form} onClose={closeForm} title={`${form?.row ? "Edit " : ""}${active?.title || ""}`} description={active?.description}>
        {form && active && (
          <ResourceForm
            fields={active.fields}
            row={form.row}
            defaults={{ date: isoDate(), amount_now: 0, amount_later: 0 }}
            summary={summary}
            submitting={save.isPending}
            error={formError}
            submitLabel={form.row ? "Save changes" : `Record ${active.title.toLowerCase()}`}
            onCancel={closeForm}
            onSubmit={(values) => {
              setFormError("");
              save.mutate(
                { id: form.row?.id, payload: { ...(toPayload(active.fields, values) as Row), type: form.type } },
                {
                  onSuccess: () => {
                    toast.success(`${active.title} ${form.row ? "updated" : "recorded"}`);
                    closeForm();
                  },
                  onError: (e) => setFormError(errorMessage(e)),
                }
              );
            }}
          />
        )}
      </Modal>

      <ConfirmDelete
        open={!!deleting}
        label={deleting ? `${deleting.party_name} - ${money(Number(deleting.amount_now) + Number(deleting.amount_later))}` : ""}
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => toast.success("Transaction and its journal entries deleted"),
            onError: (e) => toast.error(errorMessage(e)),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </>
  );
}
