"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: keyof typeof widths;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-slate-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative flex max-h-[92vh] w-full animate-pop flex-col rounded-t-2xl border border-line bg-surface shadow-pop sm:rounded-2xl",
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1">
            <X className="size-4.5" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDelete({
  open,
  label,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title="Delete record" size="sm">
      <div className="p-6">
        <div className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle className="size-5" />
          </span>
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-bold text-fg">{label}</span> will be permanently deleted. This cannot be undone.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
