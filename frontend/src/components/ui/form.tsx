import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export const controlClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none transition placeholder:text-muted/60 dark:border-white/12 dark:bg-white/[0.03] " +
  "focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} className={cn(controlClass, "h-auto min-h-20 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(controlClass, "appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex h-10 items-center gap-3 text-sm disabled:opacity-60"
    >
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-brand" : "bg-fg/15")}>
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </span>
      {label && <span className="text-fg">{checked ? "Yes" : "No"}</span>}
    </button>
  );
}

export function Field({
  label,
  required,
  error,
  help,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-fg">
        {label}
        {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-danger">{error}</span> : help ? <span className="mt-1 block text-xs text-muted">{help}</span> : null}
    </label>
  );
}
