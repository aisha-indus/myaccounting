"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { site } from "@/config/site";
import { useAuth } from "@/lib/auth";
import { Button } from "../ui/button";

interface Step {
  /** Element to spotlight: [data-tour="..."]. Omit for a centred card. */
  target?: string;
  title: string;
  text: string;
}

/** Onboarding tour (SRS 5.3). Edit the steps here; add data-tour="name" to any element to point at it. */
const STEPS: Step[] = [
  { title: `Welcome to ${site.name}`, text: "A one-minute look at where things are. You can skip at any time and replay it later from the ? button." },
  { target: "nav", title: "Everything starts in this menu", text: "Task Management, Accounting and User Management. You only see the modules your role is allowed to open." },
  { target: "stats", title: "Your dashboard", text: "Cash, money in and out, open tasks and project progress at a glance. The numbers update as records are added." },
  { target: "clock", title: "Clock in and out", text: "One click logs your time on the Time Sheet. Those hours are used when the monthly Pay Sheet is generated." },
  { target: "appearance", title: "Make it yours", text: "Switch between light and dark, pick an accent colour and choose your currency." },
  { target: "help", title: "Need this again?", text: "Click the ? button whenever you want to replay this tour." },
  {
    title: "A good order to start in",
    text: "1. Add your Business.  2. Check Ledger Accounts.  3. Add Customers and Vendors.  4. Create an Invoice or record Money In / Money Out.  The balance sheet keeps itself balanced.",
  },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_W = 340;

export function Tour() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [index, setIndex] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  // Steps whose target is not on this screen (e.g. no clock button for this user) are left out.
  const [steps, setSteps] = useState<Step[]>(STEPS);
  const start = useCallback(() => {
    setSteps(STEPS.filter((s) => !s.target || visible(document.querySelector(`[data-tour="${s.target}"]`))));
    setIndex(0);
  }, []);

  const key = user ? `ibms_tour_done_${user.id}` : "";

  // First sign-in on this device: start automatically once the dashboard has drawn.
  useEffect(() => {
    if (!user || pathname !== "/dashboard") return;
    let done = true;
    try {
      done = !!localStorage.getItem(key);
    } catch {
      /* storage unavailable: do not auto-start */
    }
    if (done) return;
    const timer = setTimeout(start, 900);
    return () => clearTimeout(timer);
  }, [user, pathname, key, start]);

  useEffect(() => {
    window.addEventListener("ibms:tour", start);
    return () => window.removeEventListener("ibms:tour", start);
  }, [start]);

  const finish = useCallback(() => {
    setIndex(null);
    try {
      if (key) localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, [key]);

  const step = index === null ? null : steps[index];

  // Measure the spotlight target, and keep it right when the window changes.
  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      if (!el || !visible(el)) return setBox(null);
      el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect();
      // Tall targets (the whole menu) are clipped to the viewport so the card can sit beside them.
      const top = Math.max(r.top, 0);
      const height = Math.min(r.bottom, window.innerHeight) - top;
      setBox({ top: top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: height + PAD * 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => (i === null ? i : Math.min(i + 1, steps.length - 1)));
      if (e.key === "ArrowLeft") setIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, steps.length, finish]);

  if (index === null || !step) return null;
  const last = index === steps.length - 1;

  // Card position: beside wide-short targets go below; beside tall targets go right; otherwise centre.
  let card: React.CSSProperties = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  if (box) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampX = (x: number) => Math.max(12, Math.min(x, vw - CARD_W - 12));
    if (box.height > vh * 0.5 && box.left + box.width + CARD_W + 24 < vw) card = { top: Math.max(24, box.top + 40), left: box.left + box.width + 16 };
    else if (box.top + box.height + 220 < vh) card = { top: box.top + box.height + 14, left: clampX(box.left + box.width / 2 - CARD_W / 2) };
    else card = { top: Math.max(12, box.top - 14), left: clampX(box.left + box.width / 2 - CARD_W / 2), transform: "translateY(-100%)" };
  }

  return (
    <div className="no-print fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* The spotlight is a transparent box whose huge shadow darkens everything else. */}
      {box ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-white/70 transition-all duration-300"
          style={{ ...box, boxShadow: "0 0 0 200vmax rgb(2 6 23 / 0.66)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/65" />
      )}
      <div className="absolute inset-0" onClick={finish} />

      <div className="absolute animate-pop rounded-2xl border border-line bg-surface p-5 shadow-pop transition-all duration-300" style={{ ...card, width: CARD_W, maxWidth: "calc(100vw - 24px)" }}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold tracking-widest text-brand-text uppercase">
            Step {index + 1} of {steps.length}
          </p>
          <button type="button" onClick={finish} aria-label="Skip the tour" className="-mt-1 -mr-1 flex size-7 items-center justify-center rounded-lg text-muted hover:bg-fg/5 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <h3 className="mt-1.5 text-base font-extrabold tracking-tight">{step.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{step.text}</p>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand" : "w-1.5 bg-fg/15"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIndex(index - 1)}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
            )}
            {index === 0 && (
              <Button variant="ghost" size="sm" onClick={finish}>
                Skip
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? finish() : setIndex(index + 1))}>
              {last ? "Get started" : "Next"}
              {!last && <ArrowRight className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
}
