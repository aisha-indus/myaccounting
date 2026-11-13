"use client";

import { useMutation } from "@tanstack/react-query";
import { CreditCard, HandCoins, Mail, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ResourcePage } from "@/components/resource/resource-page";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/primitives";
import { customers } from "@/config/resources";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";

export default function CustomersPage() {
  const { canEdit } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ResourcePage
        config={customers}
        headerActions={
          canEdit("customers") && (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <Mail className="size-4" />
              Email customers
            </Button>
          )
        }
        tabs={[
          { value: "all", label: "All" },
          { value: "owing", label: "Balance due", filter: (c) => Number(c.amount_owed) > 0 },
          { value: "reminder", label: "Reminder on", filter: (c) => !!Number(c.turn_on_reminder) },
        ]}
      >
        {(rows) => (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Customers" value={rows.length} hint={`${rows.filter((r) => Number(r.amount_owed) > 0).length} with a balance due`} icon={Users} />
            <StatCard label="Owed to us" value={money(rows.reduce((s, r) => s + (Number(r.amount_owed) || 0), 0))} hint="Receivable from customers" icon={HandCoins} tone="success" />
            <StatCard label="Credit still available" value={money(rows.reduce((s, r) => s + (Number(r.balance_of_credit_given) || 0), 0))} hint="Across all credit limits" icon={CreditCard} tone="info" />
          </div>
        )}
      </ResourcePage>
      <EmailCustomers open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** AC-02-04: one message to every customer that has an email address. */
function EmailCustomers({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [onlyOwing, setOnlyOwing] = useState(false);

  const send = useMutation({
    mutationFn: async () => (await api.post<{ sent: number; skipped: number; smtpConfigured: boolean }>("/customers/email", { subject, message, only_owing: onlyOwing })).data,
    onSuccess: (res) => {
      if (!res.smtpConfigured) toast.warning(`Email is not set up yet, so ${res.sent} message(s) were only written to the server log. Add SMTP details in backend/.env to send them.`, { duration: 9000 });
      else toast.success(`Sent to ${res.sent} customer(s)${res.skipped ? `, ${res.skipped} skipped (no email)` : ""}`);
      setSubject("");
      setMessage("");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Email customers" description='Each message starts with "Dear [contact name]". Customers without an email are skipped.'>
      <div className="space-y-4 p-6">
        <Field label="Subject" required>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Office closed on Friday" />
        </Field>
        <Field label="Message" required>
          <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold">Only customers with a balance due</span>
          <Switch checked={onlyOwing} onChange={setOnlyOwing} label="Only owing" />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!subject.trim() || !message.trim()}>
          {!send.isPending && <Mail className="size-4" />}
          Send
        </Button>
      </div>
    </Modal>
  );
}
