"use client";

import { ChevronsLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/config/nav";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Avatar } from "../ui/primitives";
import { Logo } from "./logo";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, canView, isAdmin, signOut } = useAuth();

  // UM-03-01: only modules the user's role may access are listed.
  const groups = nav.map((g) => ({ ...g, items: g.items.filter((i) => (i.adminOnly ? isAdmin : !i.module || canView(i.module))) })).filter((g) => g.items.length);

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 animate-fade bg-slate-950/60 lg:hidden" onClick={onCloseMobile} />}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-line bg-sidebar text-sidebar-fg transition-[width,transform] duration-200",
          collapsed ? "lg:w-[76px]" : "lg:w-64",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className={cn("flex h-16 shrink-0 items-center border-b border-sidebar-line", collapsed ? "lg:justify-center lg:px-0" : "", "justify-between px-4")}>
          <Link href="/dashboard" onClick={onCloseMobile} className={cn(collapsed && "lg:hidden")}>
            <Logo light />
          </Link>
          <Link href="/dashboard" className={cn("hidden", collapsed && "lg:block")}>
            <Logo compact />
          </Link>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className={cn("hidden size-8 items-center justify-center rounded-lg text-sidebar-fg transition hover:bg-white/10 hover:text-white lg:flex", collapsed && "lg:hidden")}
          >
            <ChevronsLeft className="size-4" />
          </button>
        </div>

        <nav data-tour="nav" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className={cn("mb-2 px-3 text-[10.5px] font-bold tracking-[0.14em] text-sidebar-fg/60 uppercase", collapsed && "lg:hidden")}>{group.title}</p>
              {collapsed && <div className="mx-3 mb-2 hidden h-px bg-sidebar-line lg:block" />}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition",
                          collapsed && "lg:justify-center lg:px-0",
                          active ? "bg-white/[0.09] text-white" : "hover:bg-white/[0.05] hover:text-white"
                        )}
                      >
                        {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-brand" style={{ filter: "brightness(1.5)" }} />}
                        <item.icon className={cn("size-[18px] shrink-0", active ? "text-white" : "text-sidebar-fg/80 group-hover:text-white")} />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {user && (
          <div className={cn("flex shrink-0 items-center gap-3 border-t border-sidebar-line p-3", collapsed && "lg:flex-col")}>
            <Avatar name={user.name} size={36} />
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
              <p className="truncate text-[11.5px] capitalize">{user.role_name.replace("-", " ")}</p>
            </div>
            <button type="button" onClick={signOut} title="Sign out" aria-label="Sign out" className="flex size-8 items-center justify-center rounded-lg transition hover:bg-white/10 hover:text-white">
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
