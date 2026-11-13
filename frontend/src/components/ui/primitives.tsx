import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

// ---------------------------------------------------------------- Card
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("print-plain rounded-xl border border-line bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div>
        <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- Badge
const tones = {
  neutral: "bg-fg/[0.06] text-muted",
  brand: "bg-brand/10 text-brand-text",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  completed: "success",
  active: "success",
  "in progress": "info",
  partial: "info",
  pending: "warning",
  "on hold": "neutral",
  inactive: "neutral",
  overdue: "danger",
  paid: "success",
  unpaid: "warning",
  money_in: "success",
  money_out: "danger",
  asset: "info",
  liability: "warning",
  equity: "brand",
  income: "success",
  expense: "danger",
};
const STATUS_LABELS: Record<string, string> = { money_in: "Money In", money_out: "Money Out", completed: "Completed", partial: "Partial", pending: "Pending" };

export function StatusBadge({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted">-</span>;
  const key = String(value).toLowerCase();
  return (
    <Badge tone={STATUS_TONES[key] || "neutral"} dot>
      {STATUS_LABELS[key] || String(value)}
    </Badge>
  );
}

// ---------------------------------------------------------------- Avatar
export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} style={style} className="shrink-0 rounded-full object-cover ring-1 ring-line" />;
  }
  return (
    <span style={style} className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand/12 font-bold text-brand-text">
      {initials(name) || "?"}
    </span>
  );
}

// ---------------------------------------------------------------- Progress
export function Progress({ value, tone }: { value: number; tone?: "brand" | "success" | "danger" }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const color = tone === "danger" ? "bg-danger" : tone === "success" || v >= 100 ? "bg-success" : "bg-brand";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-fg/[0.08]">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- Page header
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Stat card
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card className="flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="num mt-1.5 truncate text-2xl font-extrabold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="size-5" />
      </span>
    </Card>
  );
}

// ---------------------------------------------------------------- Empty state
export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-fg/[0.05] text-muted">
        <Icon className="size-6" />
      </span>
      <p className="text-sm font-bold">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[13px] text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Tabs (pill filter)
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="no-print inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-card">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition",
            value === item.value ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-fg/5 hover:text-fg"
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={cn("num rounded-full px-1.5 text-[11px]", value === item.value ? "bg-white/20" : "bg-fg/[0.07]")}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
