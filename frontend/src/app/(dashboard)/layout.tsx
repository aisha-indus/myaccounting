"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Tour } from "@/components/layout/tour";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { allNavItems } from "@/config/nav";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, canView, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("ibms_sidebar") === "collapsed");
  }, []);
  const toggle = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem("ibms_sidebar", next ? "collapsed" : "open");
  };

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-7 animate-spin text-brand-text" />
      </div>
    );
  }

  // UM-03-04: a module the role may not open shows a clear message instead of its content.
  const item = allNavItems.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  const allowed = !item || (item.adminOnly ? isAdmin : !item.module || canView(item.module));

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => toggle(true)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <Topbar onOpenMobile={() => setMobileOpen(true)} collapsed={collapsed} onExpand={() => toggle(false)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {allowed ? (
            children
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="You do not have access to this module"
              hint={`Your role (${user.role_name}) cannot open ${item?.label}. Ask a super admin if you need it.`}
              action={
                <Link href="/dashboard">
                  <Button>Back to dashboard</Button>
                </Link>
              }
            />
          )}
        </main>
      </div>
      <Tour />
    </div>
  );
}
