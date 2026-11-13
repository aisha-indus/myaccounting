"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Banknote, CircleDollarSign, Download, Eye, FileClock, HandCoins, Pencil, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { formatCell } from "@/components/resource/cells";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDelete, Modal } from "@/components/ui/modal";
import { PageHeader, StatCard, StatusBadge, Tabs } from "@/components/ui/primitives";
import { site } from "@/config/site";
import { type Row, useList, useRemove, useSave } from "@/hooks/use-resource";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { date, getCurrency, isoDate, money } from "@/lib/format";

const num = (label: string, min = 0) => z.preprocess((v) => (v === "" || v === null || v === undefined ? NaN : Number(v)), z.number({ error: `${label} is required` }).min(min, `${label} cannot be less than ${min}`));
const optionalId = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().nullable());

const schema = z
  .object({
    customer_id: z.preprocess((v) => (v === "" ? NaN : Number(v)), z.number({ error: "Select a customer" }).min(1, "Select a customer")),
    business_id: optionalId,
    ledger_account_id: optionalId,
    issue_date: z.string().min(1, "Issue date is required"),
    due_date: z.string(),
    tax_rate: z.preprocess((v) => (v === "" || v === null || v === undefined ? 0 : Number(v)), z.number().min(0, "Cannot be negative").max(100, "Cannot be more than 100")),
    notes: z.string(),
    items: z
      .array(z.object({ description: z.string().trim().min(1, "Describe the item"), quantity: num("Quantity", 0.01), unit_price: num("Price") }))
      .min(1, "Add at least one line"),
  })
  .refine((v) => !v.due_date || v.due_date >= v.issue_date, { path: ["due_date"], message: "Cannot be before the issue date" });

type Mode = { kind: "form"; id?: number } | { kind: "view"; id: number } | { kind: "pay"; row: Row } | { kind: "delete"; row: Row } | null;

const n = (v: unknown) => Number(v) || 0;

export default function InvoicesPage() {
  const { canEdit } = useAuth();
  const canWrite = canEdit("invoices");
  const { data = [], isLoading, error } = useList("invoices");
  const remove = useRemove("invoices");
  const [tab, setTab] = useState("all");
  const [mode, setMode] = useState<Mode>(null);
  const close = () => setMode(null);

  const rows = useMemo(() => (tab === "all" ? data : data.filter((i) => i.status === tab)), [data, tab]);
  const sum = (key: string) => data.reduce((s, i) => s + n(i[key]), 0);

  const columns = useMemo<ColumnDef<Row, any>[]>(() => {
    const col = (id: string, header: string, cell: (r: Row) => React.ReactNode, align: "left" | "right" = "left"): ColumnDef<Row, any> => ({
      id,
      accessorFn: (r) => r[id],
      header,
      cell: ({ row }) => cell(row.original),
      meta: { label: header, align },
    });
    const btn = "flex size-8 items-center justify-center rounded-lg text-muted transition";
    return [
      col("invoice_number", "Invoice", (r) => <span className="num font-bold">{r.invoice_number}</span>),
      col("contact_name", "Customer", (r) => (
        <div>
          <p className="font-semibold">{r.customer_business || r.contact_name}</p>
          {r.customer_business && <p className="text-xs text-muted">{r.contact_name}</p>}
        </div>
      )),
      col("issue_date", "Issued", (r) => formatCell("date", r.issue_date)),
      col("due_date", "Due", (r) => formatCell("date", r.due_date)),
      col("total", "Total", (r) => formatCell("money", r.total), "right"),
      col("amount_paid", "Paid", (r) => (n(r.amount_paid) ? <span className="num font-semibold text-success">{money(r.amount_paid)}</span> : <span className="text-muted/50">-</span>), "right"),
      col("balance", "Balance", (r) => (n(r.balance) ? formatCell("money", r.balance) : <span className="text-muted/50">-</span>), "right"),
      col("status", "Status", (r) => <StatusBadge value={r.status} />),
      {
        id: "_actions",
        header: "",
        enableSorting: false,
        enableGlobalFilter: false,
        meta: { utility: true, align: "right" },
        cell: ({ row: { original: r } }) => (
          <div className="flex items-center justify-end gap-0.5">
            {canWrite && n(r.balance) > 0 && (
              <Button variant="soft" size="sm" className="mr-1 h-7 px-2.5 text-xs" onClick={() => setMode({ kind: "pay", row: r })}>
                <HandCoins className="size-3.5" />
                Receive
              </Button>
            )}
            <button type="button" title="View" aria-label="View" onClick={() => setMode({ kind: "view", id: r.id })} className={cn(btn, "hover:bg-fg/5 hover:text-fg")}>
              <Eye className="size-4" />
            </button>
            {canWrite && (
              <>
                <button type="button" title="Edit" aria-label="Edit" onClick={() => setMode({ kind: "form", id: r.id })} className={cn(btn, "hover:bg-brand/10 hover:text-brand-text")}>
                  <Pencil className="size-4" />
                </button>
                <button type="button" title="Delete" aria-label="Delete" onClick={() => setMode({ kind: "delete", row: r })} className={cn(btn, "hover:bg-danger/10 hover:text-danger")}>
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        ),
      },
    ];
  }, [canWrite]);

  const newButton = canWrite && (
    <Button onClick={() => setMode({ kind: "form" })}>
      <Plus className="size-4" />
      New invoice
    </Button>
  );

  return (
    <>
      <PageHeader title="Invoices" description="Bill a customer. The amount goes to receivables and the customer's balance; payments bring both back down." actions={newButton} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoiced" value={money(sum("total"))} hint={`${data.length} invoice(s)`} icon={ReceiptText} />
        <StatCard label="Received" value={money(sum("amount_paid"))} hint="Payments against invoices" icon={Banknote} tone="success" />
        <StatCard label="Outstanding" value={money(sum("balance"))} hint="Still to be paid" icon={CircleDollarSign} tone="info" />
        <StatCard
          label="Overdue"
          value={money(data.filter((i) => i.status === "Overdue").reduce((s, i) => s + n(i.balance), 0))}
          hint={`${data.filter((i) => i.status === "Overdue").length} past the due date`}
          icon={FileClock}
          tone="danger"
        />
      </div>

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[{ value: "all", label: "All", count: data.length }, ...["Unpaid", "Partial", "Overdue", "Paid"].map((s) => ({ value: s, label: s, count: data.filter((i) => i.status === s).length }))]}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error ? errorMessage(error) : undefined}
        searchPlaceholder="Search invoices..."
        exportName="invoices"
        exportTitle="Invoices"
        emptyTitle="No invoices yet"
        emptyHint={canWrite ? "Create your first invoice to bill a customer." : undefined}
        emptyAction={newButton || undefined}
      />

      <Modal open={mode?.kind === "form"} onClose={close} size="lg" title={mode?.kind === "form" && mode.id ? "Edit invoice" : "New invoice"} description="Totals are calculated for you and posted to the ledger when you save.">
        {mode?.kind === "form" && <InvoiceForm id={mode.id} onDone={close} />}
      </Modal>

      <Modal open={mode?.kind === "view"} onClose={close} size="lg" title="Invoice" description="Download it as a PDF to send to the customer.">
        {mode?.kind === "view" && <InvoiceView id={mode.id} onClose={close} />}
      </Modal>

      <Modal open={mode?.kind === "pay"} onClose={close} size="sm" title="Receive payment" description={mode?.kind === "pay" ? `${mode.row.invoice_number} - ${mode.row.customer_business || mode.row.contact_name}` : undefined}>
        {mode?.kind === "pay" && <PaymentForm invoice={mode.row} onDone={close} />}
      </Modal>

      <ConfirmDelete
        open={mode?.kind === "delete"}
        label={mode?.kind === "delete" ? `${mode.row.invoice_number} (${money(mode.row.total)})` : ""}
        loading={remove.isPending}
        onCancel={close}
        onConfirm={() =>
          mode?.kind === "delete" &&
          remove.mutate(mode.row.id, {
            onSuccess: () => toast.success("Invoice deleted and removed from the ledger"),
            onError: (e) => toast.error(errorMessage(e)),
            onSettled: close,
          })
        }
      />
    </>
  );
}

const useInvoice = (id?: number) => useQuery({ queryKey: ["invoices", id], queryFn: async () => (await api.get<Row>(`/invoices/${id}`)).data, enabled: !!id, retry: false });

// ---------------------------------------------------------------- form
function InvoiceForm({ id, onDone }: { id?: number; onDone: () => void }) {
  const { data: existing, isLoading } = useInvoice(id);
  if (id && (isLoading || !existing)) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-10" />
        ))}
      </div>
    );
  }
  return <InvoiceFields existing={existing} onDone={onDone} />;
}

function InvoiceFields({ existing, onDone }: { existing?: Row; onDone: () => void }) {
  const save = useSave("invoices");
  const [serverError, setServerError] = useState("");
  const { data: customers = [] } = useList("lookup/customers");
  const { data: businesses = [] } = useList("lookup/businesses");
  const { data: accounts = [] } = useList("lookup/ledger-accounts");
  const income = accounts.filter((a) => a.account_type === "Income");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Row>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as any,
    defaultValues: existing
      ? {
          customer_id: existing.customer_id,
          business_id: existing.business_id ?? "",
          ledger_account_id: existing.ledger_account_id ?? "",
          issue_date: String(existing.issue_date).slice(0, 10),
          due_date: existing.due_date ? String(existing.due_date).slice(0, 10) : "",
          tax_rate: existing.tax_rate,
          notes: existing.notes || "",
          items: existing.items.map((it: Row) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price })),
        }
      : { customer_id: "", business_id: "", ledger_account_id: "", issue_date: isoDate(), due_date: "", tax_rate: 0, notes: "", items: [{ description: "", quantity: 1, unit_price: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control });
  const items: Row[] = watched.items || [];
  const subtotal = items.reduce((s, it) => s + n(it.quantity) * n(it.unit_price), 0);
  const tax = (subtotal * n(watched.tax_rate)) / 100;
  const itemErrors = errors.items as unknown as (Record<string, { message?: string }> | undefined)[] & { message?: string; root?: { message?: string } };

  const submit = handleSubmit((values) => {
    setServerError("");
    save.mutate(
      { id: existing?.id, payload: { ...values, due_date: values.due_date || null } },
      {
        onSuccess: () => {
          toast.success(`Invoice ${existing ? "updated" : "created"}`);
          onDone();
        },
        onError: (e) => setServerError(errorMessage(e)),
      }
    );
  });

  const err = (name: string) => errors[name]?.message as string | undefined;

  return (
    <form onSubmit={submit} method="post" noValidate>
      <div className="space-y-6 px-6 py-5">
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="Customer" required error={err("customer_id")}>
            <Select aria-invalid={!!errors.customer_id} {...register("customer_id")}>
              <option value="">Select...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name ? `${c.business_name} (${c.contact_name})` : c.contact_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From business" help="Shown as the sender on the invoice.">
            <Select {...register("business_id")}>
              <option value="">Customer's linked business</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.business_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Issue date" required error={err("issue_date")}>
            <Input type="date" aria-invalid={!!errors.issue_date} {...register("issue_date")} />
          </Field>
          <Field label="Due date" error={err("due_date")}>
            <Input type="date" aria-invalid={!!errors.due_date} {...register("due_date")} />
          </Field>
          <Field label="Income account" help="Where the sale is recorded. Blank uses the first income account.">
            <Select {...register("ledger_account_id")}>
              <option value="">Automatic</option>
              {income.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_code} - {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tax rate (%)" error={err("tax_rate")}>
            <Input type="number" step="0.01" min={0} max={100} className="num" aria-invalid={!!errors.tax_rate} {...register("tax_rate")} />
          </Field>
        </div>

        <div>
          <p className="mb-3 flex items-center gap-3 text-[11px] font-bold tracking-widest text-muted uppercase">
            Items <span className="h-px flex-1 bg-line" />
          </p>
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_90px_130px_120px_32px] gap-2 px-1 text-xs font-semibold text-muted sm:grid">
              <span>Description</span>
              <span>Qty</span>
              <span>Price</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {fields.map((f, i) => {
              const e = itemErrors?.[i];
              const message = e?.description?.message || e?.quantity?.message || e?.unit_price?.message;
              return (
                <div key={f.id}>
                  <div className="grid grid-cols-[1fr_32px] items-center gap-2 sm:grid-cols-[1fr_90px_130px_120px_32px]">
                    <Input placeholder="What was sold" aria-label="Description" aria-invalid={!!e?.description} className="col-span-2 sm:col-span-1" {...register(`items.${i}.description`)} />
                    <Input type="number" step="0.01" min={0} aria-label="Quantity" aria-invalid={!!e?.quantity} className="num" {...register(`items.${i}.quantity`)} />
                    <Input type="number" step="0.01" min={0} placeholder="0.00" aria-label="Price" aria-invalid={!!e?.unit_price} className="num" {...register(`items.${i}.unit_price`)} />
                    <span className="num hidden text-right text-sm font-semibold sm:block">{money(n(items[i]?.quantity) * n(items[i]?.unit_price))}</span>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      disabled={fields.length === 1}
                      aria-label="Remove line"
                      className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {message && <p className="mt-1 text-xs font-medium text-danger">{message}</p>}
                </div>
              );
            })}
          </div>
          <Button variant="soft" size="sm" className="mt-3" onClick={() => append({ description: "", quantity: 1, unit_price: "" })}>
            <Plus className="size-4" />
            Add line
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_260px]">
          <Field label="Notes" help="Printed at the bottom of the invoice.">
            <Textarea rows={4} placeholder="Payment terms, bank details, thank you note..." {...register("notes")} />
          </Field>
          <dl className="space-y-2 self-end rounded-xl border border-line bg-surface-2 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="num font-semibold">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax ({n(watched.tax_rate)}%)</dt>
              <dd className="num font-semibold">{money(tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="font-bold">Total</dt>
              <dd className="num text-lg font-extrabold text-brand-text">{money(subtotal + tax)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-b-2xl">
        {serverError ? (
          <p className="flex items-center gap-2 text-[13px] font-medium text-danger">
            <AlertCircle className="size-4 shrink-0" />
            {serverError}
          </p>
        ) : (
          <span />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {existing ? "Save changes" : "Create invoice"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- payment
function PaymentForm({ invoice, onDone }: { invoice: Row; onDone: () => void }) {
  const pay = useSave(`invoices/${invoice.id}/payments`);
  const [amount, setAmount] = useState(String(invoice.balance));
  const [day, setDay] = useState(isoDate());
  const value = Number(amount);
  const invalid = !(value > 0) || value > n(invoice.balance);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm">
        <span className="text-muted">Still due</span>
        <span className="num text-lg font-extrabold">{money(invoice.balance)}</span>
      </div>
      <div className="space-y-4">
        <Field label="Amount received" required error={amount && invalid ? `Enter an amount up to ${money(invoice.balance)}` : undefined}>
          <Input type="number" step="0.01" min={0} className="num" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!amount && invalid} />
        </Field>
        <Field label="Date" required>
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={invalid || !day}
          loading={pay.isPending}
          onClick={() =>
            pay.mutate(
              { payload: { amount: value, date: day } },
              {
                onSuccess: () => {
                  toast.success(`Payment of ${money(value)} recorded`);
                  onDone();
                },
                onError: (e) => toast.error(errorMessage(e)),
              }
            )
          }
        >
          Record payment
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- view + PDF
function InvoiceView({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: inv, isLoading, error } = useInvoice(id);
  if (isLoading || !inv) {
    return error ? (
      <p className="p-6 text-sm text-danger">{errorMessage(error)}</p>
    ) : (
      <div className="space-y-3 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-8" />
        ))}
      </div>
    );
  }
  const from = inv.from_business || site.fullName;

  return (
    <>
      <div className="px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-extrabold tracking-tight">{from}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{[inv.from_email, inv.from_phone, inv.from_web].filter(Boolean).join("  |  ") || " "}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold tracking-tight text-brand-text">INVOICE</p>
            <p className="num mt-0.5 text-sm font-bold">{inv.invoice_number}</p>
            <div className="mt-2">
              <StatusBadge value={inv.status} />
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-muted uppercase">Bill to</p>
            <p className="mt-1.5 text-sm font-bold">{inv.customer_business || inv.contact_name}</p>
            <p className="text-[13px] leading-relaxed text-muted">
              {inv.customer_business && <>{inv.contact_name}<br /></>}
              {inv.customer_email}
              {inv.customer_phone && <><br />{inv.customer_phone}</>}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-muted uppercase">Issued</p>
            <p className="num mt-1.5 text-sm font-semibold">{date(inv.issue_date)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-muted uppercase">Due</p>
            <p className="num mt-1.5 text-sm font-semibold">{date(inv.due_date)}</p>
          </div>
        </div>

        <div className="mt-7 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-[11px] font-bold tracking-wider text-muted uppercase">
                <th className="h-10 px-4 text-left">Description</th>
                <th className="px-4 text-right">Qty</th>
                <th className="px-4 text-right">Price</th>
                <th className="px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {inv.items.map((it: Row) => (
                <tr key={it.id}>
                  <td className="px-4 py-2.5">{it.description}</td>
                  <td className="num px-4 text-right">{n(it.quantity)}</td>
                  <td className="num px-4 text-right">{money(it.unit_price)}</td>
                  <td className="num px-4 text-right font-semibold">{money(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_260px]">
          <div className="text-[13px] leading-relaxed text-muted">
            {inv.notes && (
              <>
                <p className="mb-1 text-[11px] font-bold tracking-widest uppercase">Notes</p>
                <p className="whitespace-pre-line">{inv.notes}</p>
              </>
            )}
            {inv.payments.length > 0 && (
              <div className={cn(inv.notes && "mt-4")}>
                <p className="mb-1 text-[11px] font-bold tracking-widest uppercase">Payments received</p>
                {inv.payments.map((p: Row) => (
                  <p key={p.id} className="num">
                    {date(p.date)} - {money(p.amount)}
                  </p>
                ))}
              </div>
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="num font-semibold">{money(inv.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax ({n(inv.tax_rate)}%)</dt>
              <dd className="num font-semibold">{money(inv.tax_amount)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="font-bold">Total</dt>
              <dd className="num font-extrabold">{money(inv.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Paid</dt>
              <dd className="num font-semibold text-success">{money(inv.amount_paid)}</dd>
            </div>
            <div className="flex justify-between rounded-lg bg-brand/10 px-3 py-2">
              <dt className="font-bold">Balance due</dt>
              <dd className="num font-extrabold text-brand-text">{money(inv.balance)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => downloadInvoicePdf(inv).catch(() => toast.error("The PDF could not be created."))}>
          <Download className="size-4" />
          Download PDF
        </Button>
      </div>
    </>
  );
}

/** Builds the invoice as an A4 PDF. Amounts use the currency code so every font can print them. */
async function downloadInvoicePdf(inv: Row) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cur = getCurrency();
  const amt = (v: unknown) => `${cur} ${n(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const right = doc.internal.pageSize.getWidth() - 40;

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(20);
  doc.text(String(inv.from_business || site.fullName), 40, 52);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  doc.text([inv.from_email, inv.from_phone, inv.from_web].filter(Boolean).join("   |   "), 40, 68);

  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(15, 118, 110);
  doc.text("INVOICE", right, 52, { align: "right" });
  doc.setFontSize(10).setTextColor(20);
  doc.text(String(inv.invoice_number), right, 68, { align: "right" });

  doc.setFontSize(8).setTextColor(110);
  doc.text("BILL TO", 40, 110);
  doc.text("ISSUED", 300, 110);
  doc.text("DUE", 420, 110);
  doc.setFontSize(11).setTextColor(20);
  doc.text(String(inv.customer_business || inv.contact_name), 40, 126);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(date(inv.issue_date), 300, 126);
  doc.text(date(inv.due_date), 420, 126);
  doc.setFontSize(9).setTextColor(110);
  doc.text([inv.customer_business ? inv.contact_name : "", inv.customer_email, inv.customer_phone].filter(Boolean).map(String), 40, 140);

  autoTable(doc, {
    startY: 190,
    head: [["Description", "Qty", "Price", "Amount"]],
    body: inv.items.map((it: Row) => [it.description, String(n(it.quantity)), amt(it.unit_price), amt(it.amount)]),
    styles: { fontSize: 9.5, cellPadding: 7 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = ((doc as any).lastAutoTable?.finalY || 220) + 24;
  const line = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 11 : 10).setTextColor(bold ? 20 : 90);
    doc.text(label, right - 190, y);
    doc.setTextColor(20);
    doc.text(value, right, y, { align: "right" });
    y += 18;
  };
  line("Subtotal", amt(inv.subtotal));
  line(`Tax (${n(inv.tax_rate)}%)`, amt(inv.tax_amount));
  line("Total", amt(inv.total), true);
  line("Paid", amt(inv.amount_paid));
  line("Balance due", amt(inv.balance), true);

  if (inv.notes) {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(110);
    doc.text("NOTES", 40, y + 16);
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(60);
    doc.text(doc.splitTextToSize(String(inv.notes), right - 40), 40, y + 32);
  }
  doc.save(`${inv.invoice_number}.pdf`);
}
