"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, BookCheck, HandCoins, Receipt, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ResourcePage } from "@/components/resource/resource-page";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/primitives";
import { paySheet } from "@/config/resources";
import { type Row, useList } from "@/hooks/use-resource";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isoDate, money, month as fmtMonth } from "@/lib/format";

const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

export default function PayrollPage() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(isoDate().slice(0, 7));

  const generate = useMutation({
    mutationFn: async () => (await api.post<{ created: number }>("/master-pay-sheet/generate", { month })).data,
    onSuccess: (res) => {
      toast.success(res.created ? `Created ${res.created} pay sheet entries` : "Every active member already has an entry for that month");
      setOpen(false);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const { data: sheet = [] } = useList("master-pay-sheet");
  const unposted = sheet.filter((r) => !Number(r.posted) && Number(r.gross_payout) > 0).length;
  const post = useMutation({
    mutationFn: async () => (await api.post<{ posted: number }>("/master-pay-sheet/post")).data,
    onSuccess: (res) => {
      toast.success(`Posted ${res.posted} pay sheet entries to the ledger`);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <ResourcePage
        config={paySheet}
        headerActions={
          canEdit("master-pay-sheet") && (
            <>
              {unposted > 0 && (
                <Button variant="soft" onClick={() => post.mutate()} loading={post.isPending}>
                  {!post.isPending && <BookCheck className="size-4" />}
                  Post {unposted} to ledger
                </Button>
              )}
              <Button variant="secondary" onClick={() => setOpen(true)}>
                <Wand2 className="size-4" />
                Generate month
              </Button>
            </>
          )
        }
      >
        {(rows) => {
          // Totals are for the most recent month on the sheet.
          const latest = rows.reduce((m, r) => (String(r.month) > m ? String(r.month) : m), "");
          const current = rows.filter((r) => String(r.month) === latest);
          const label = latest ? fmtMonth(latest) : "No payroll yet";
          return (
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <StatCard label="Gross pay-out" value={money(sum(current, "gross_payout"))} hint={label} icon={Banknote} />
              <StatCard
                label="Deductions"
                value={money(sum(current, "tax_withheld") + sum(current, "gratuity") + sum(current, "insurance") + sum(current, "other_deductions"))}
                hint="Tax, gratuity, insurance, other"
                icon={Receipt}
                tone="warning"
              />
              <StatCard label="Net pay-out" value={money(sum(current, "net_payout"))} hint={`${current.length} team member(s)`} icon={HandCoins} tone="success" />
            </div>
          );
        }}
      </ResourcePage>

      <Modal open={open} onClose={() => setOpen(false)} size="sm" title="Generate pay sheet" description="Creates an entry for every active team member from their salary, rates and clocked time sheet hours, and posts it to the ledger.">
        <div className="p-6">
          <Field label="Month" help="Members who already have an entry for this month are skipped.">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => generate.mutate()} loading={generate.isPending} disabled={!month}>
              Generate
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
