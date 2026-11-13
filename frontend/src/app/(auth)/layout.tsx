import { BarChart3, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { site } from "@/config/site";

const points = [
  { icon: BarChart3, title: "Double-entry accounting", text: "Every money in and money out posts balanced journal entries automatically." },
  { icon: ClipboardCheck, title: "Projects, tasks and payroll", text: "Track progress, time and cost per project, then run the monthly pay sheet." },
  { icon: ShieldCheck, title: "Role-based access", text: "Each person sees only the modules their role allows." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Soft brand glow and a ledger-style grid */}
        <div className="pointer-events-none absolute -top-40 -left-32 size-[520px] rounded-full bg-brand opacity-30 blur-[120px]" />
        <div className="pointer-events-none absolute right-[-180px] bottom-[-200px] size-[480px] rounded-full bg-brand opacity-20 blur-[130px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "44px 44px" }}
        />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-[1.15] font-extrabold tracking-tight">{site.tagline}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">{site.fullName} for small and medium businesses.</p>
          <ul className="mt-10 space-y-6">
            {points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <p.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">{p.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">
          &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
