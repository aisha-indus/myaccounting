"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsRight, CircleHelp, Clock, LogIn, LogOut, Menu, Moon, Palette, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { allNavItems } from "@/config/nav";
import { site } from "@/config/site";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { getCurrency } from "@/lib/format";
import { Button } from "../ui/button";

export function Topbar({ onOpenMobile, collapsed, onExpand }: { onOpenMobile: () => void; collapsed: boolean; onExpand: () => void }) {
  const pathname = usePathname();
  const current = allNavItems.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6">
      <Button variant="ghost" size="icon" onClick={onOpenMobile} aria-label="Open menu" className="lg:hidden">
        <Menu className="size-5" />
      </Button>
      {collapsed && (
        <Button variant="ghost" size="icon" onClick={onExpand} aria-label="Expand sidebar" className="hidden lg:inline-flex">
          <ChevronsRight className="size-4" />
        </Button>
      )}
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="hidden text-muted sm:inline">{site.name}</span>
        <span className="hidden text-muted/50 sm:inline">/</span>
        <span className="truncate font-bold">{current?.label || "Dashboard"}</span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <ClockButton />
        <Button variant="ghost" size="icon" data-tour="help" onClick={() => window.dispatchEvent(new Event("ibms:tour"))} aria-label="Show the tour" title="Show the tour">
          <CircleHelp className="size-[18px]" />
        </Button>
        <Appearance />
      </div>
    </header>
  );
}

/** TM-04-05: one button to clock in / out. Only shown when the user is linked to a team member. */
function ClockButton() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["clock"],
    queryFn: async () => (await api.get<{ linked: boolean; clockedIn: boolean; since: string | null }>("/master-time-sheet/clock")).data,
    retry: false,
  });
  const toggle = useMutation({
    mutationFn: async () => (await api.post<{ clockedIn: boolean; time: string }>("/master-time-sheet/clock")).data,
    onSuccess: (res) => {
      toast.success(res.clockedIn ? `Clocked in at ${res.time.slice(0, 5)}` : `Clocked out at ${res.time.slice(0, 5)}`);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!data?.linked) return null;
  return (
    <Button data-tour="clock" variant={data.clockedIn ? "soft" : "secondary"} size="sm" onClick={() => toggle.mutate()} loading={toggle.isPending}>
      {!toggle.isPending && (data.clockedIn ? <LogOut className="size-4" /> : <LogIn className="size-4" />)}
      <span className="hidden sm:inline">{data.clockedIn ? "Clock out" : "Clock in"}</span>
      {data.clockedIn && data.since && (
        <span className="num hidden items-center gap-1 text-xs font-medium opacity-80 md:inline-flex">
          <Clock className="size-3" />
          {data.since.slice(0, 5)}
        </span>
      )}
    </Button>
  );
}

/** Theme, accent colour and currency. Choices are remembered on this device. */
function Appearance() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const [accent, setAccent] = useState("teal");
  const [currency, setCurrency] = useState<string>(site.currency);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "light");
    setAccent(document.documentElement.dataset.accent || "teal");
    setCurrency(getCurrency());
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const applyTheme = (next: string) => {
    document.documentElement.dataset.theme = next;
    localStorage.setItem("ibms_theme", next);
    setTheme(next);
  };
  const applyAccent = (next: string) => {
    document.documentElement.dataset.accent = next;
    localStorage.setItem("ibms_accent", next);
    setAccent(next);
  };
  const applyCurrency = (next: string) => {
    localStorage.setItem("ibms_currency", next);
    window.location.reload(); // every amount on screen is re-rendered in the new currency
  };

  return (
    <div className="relative flex" ref={ref} data-tour="appearance">
      <Button variant="ghost" size="icon" onClick={() => applyTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle dark mode" title="Toggle dark mode">
        {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Appearance" title="Appearance" aria-expanded={open}>
        <Palette className="size-[18px]" />
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 animate-pop rounded-2xl border border-line bg-surface p-4 shadow-pop">
          <p className="text-sm font-bold">Appearance</p>
          <p className="mt-0.5 text-xs text-muted">Saved on this device.</p>

          <p className="mt-4 mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Theme</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["light", Sun, "Light"],
                ["dark", Moon, "Dark"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyTheme(value)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-lg border text-[13px] font-semibold transition",
                  theme === value ? "border-brand bg-brand/10 text-brand-text" : "border-line text-muted hover:text-fg"
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <p className="mt-4 mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Accent colour</p>
          <div className="flex gap-2">
            {site.accents.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.label}
                aria-label={a.label}
                aria-pressed={accent === a.id}
                onClick={() => applyAccent(a.id)}
                style={{ background: a.swatch }}
                className={cn("flex size-8 items-center justify-center rounded-full text-white transition hover:scale-110", accent === a.id && "ring-2 ring-fg/70 ring-offset-2 ring-offset-surface")}
              >
                {accent === a.id && <Check className="size-4" strokeWidth={3} />}
              </button>
            ))}
          </div>

          <p className="mt-4 mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Currency</p>
          <div className="grid grid-cols-3 gap-2">
            {site.currencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => c !== currency && applyCurrency(c)}
                className={cn(
                  "num h-9 rounded-lg border text-[13px] font-semibold transition",
                  currency === c ? "border-brand bg-brand/10 text-brand-text" : "border-line text-muted hover:text-fg"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
