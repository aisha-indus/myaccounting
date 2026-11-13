import {
  ArrowLeftRight, BarChart3, BookOpen, Building2, CalendarClock, ClipboardList, FolderKanban, History, LayoutDashboard, type LucideIcon,
  NotebookText, Puzzle, ReceiptText, ShieldCheck, SlidersHorizontal, Sparkles, Truck, UserCog, UserSquare2, Users, Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Module key that controls who sees the link (set per role in Module Access). Omit for everyone. */
  module?: string;
  /** Only super admins ever see this link. */
  adminOnly?: boolean;
}

/** Sidebar structure. Reorder, rename or remove entries here. */
export const nav: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Task Management",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban, module: "projects" },
      { href: "/tasks", label: "Tasks", icon: ClipboardList, module: "tasks" },
      { href: "/task-history", label: "Task History", icon: History, module: "task-history" },
      { href: "/team-members", label: "Team Members", icon: UserSquare2, module: "team-members" },
      { href: "/skills", label: "Skills", icon: Sparkles, module: "skills" },
      { href: "/timesheets", label: "Time Sheet", icon: CalendarClock, module: "master-time-sheet" },
      { href: "/payroll", label: "Pay Sheet", icon: Wallet, module: "master-pay-sheet" },
    ],
  },
  {
    title: "Accounting",
    items: [
      { href: "/businesses", label: "Businesses", icon: Building2, module: "businesses" },
      { href: "/customers", label: "Customers", icon: Users, module: "customers" },
      { href: "/vendors", label: "Vendors", icon: Truck, module: "vendors" },
      { href: "/invoices", label: "Invoices", icon: ReceiptText, module: "invoices" },
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, module: "transactions" },
      { href: "/ledger-accounts", label: "Ledger Accounts", icon: BookOpen, module: "ledger-accounts" },
      { href: "/journal-entries", label: "Journal Entries", icon: NotebookText, module: "journal-entries" },
      { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
    ],
  },
  {
    title: "User Management",
    items: [
      { href: "/users", label: "Users", icon: UserCog, module: "users" },
      { href: "/roles", label: "Roles", icon: ShieldCheck, module: "roles" },
      { href: "/modules", label: "Modules", icon: Puzzle, module: "modules" },
      { href: "/module-access", label: "Module Access", icon: SlidersHorizontal, adminOnly: true },
    ],
  },
];

export const allNavItems = nav.flatMap((g) => g.items);
