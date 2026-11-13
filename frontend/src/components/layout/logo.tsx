import { site } from "@/config/site";
import { cn } from "@/lib/cn";

/** Brand mark: a ledger "balance" glyph. Swap this component to use your own logo. */
export function Logo({ compact, light }: { compact?: boolean; light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm ring-1 ring-white/10">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 19V10M10 19V5M16 19v-6M22 19H2" />
          <path d="M16 6l3-2 1 3" strokeWidth="1.8" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className={cn("block text-[15px] font-extrabold tracking-tight", light ? "text-white" : "text-fg")}>{site.name}</span>
          <span className={cn("block text-[10.5px] font-medium tracking-wide", light ? "text-sidebar-fg" : "text-muted")}>Business Suite</span>
        </span>
      )}
    </span>
  );
}
