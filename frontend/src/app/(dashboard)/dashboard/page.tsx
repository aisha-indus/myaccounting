"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ClipboardList, FolderKanban, Hourglass, Landmark, ListChecks, UserSquare2 } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, CardHeader, EmptyState, Progress, StatCard, StatusBadge } from "@/components/ui/primitives";
import type { Row } from "@/hooks/use-resource";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, isoDate, money, month } from "@/lib/format";

interface Dashboard {
  projectStats: { total: number; completed: number; overdue: number; active: number };
  taskStats: { status: string; count: number }[];
  teamStats: { total: number; active: number };
  projects: Row[];
  pendingTasks: Row[];
  money: null | { money_in: number; money_out: number; receivable: number; payable: number; cash_balance: number; monthly: { month: string; money_in: number; money_out: number }[]; recent: Row[] };
}

const TASK_COLORS: Record<string, string> = { Completed: "var(--success)", "In Progress": "var(--info)", Pending: "var(--warning)", "On Hold": "var(--muted)" };

const ViewAll = ({ href }: { href: string }) => (
  <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-text hover:underline">
    View all <ArrowRight className="size-3.5" />
  </Link>
);

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs shadow-pop">
      {label && <p className="mb-1.5 font-bold">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="num ml-auto pl-4 font-bold">{money(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: async () => (await api.get<Dashboard>("/dashboard")).data, retry: false });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="skeleton h-80 rounded-xl xl:col-span-2" />
          <div className="skeleton h-80 rounded-xl" />
        </div>
      </div>
    );
  }
  if (error || !data) return <EmptyState icon={Landmark} title="Could not load the dashboard" hint={error ? errorMessage(error) : undefined} />;

  const { projectStats: ps, taskStats, teamStats, projects, pendingTasks, money: fin } = data;
  const openTasks = taskStats.filter((t) => t.status !== "Completed").reduce((s, t) => s + Number(t.count), 0);
  const totalTasks = taskStats.reduce((s, t) => s + Number(t.count), 0);
  const chart = fin?.monthly.map((m) => ({ name: month(`${m.month}-01`), "Money in": Number(m.money_in), "Money out": Number(m.money_out) })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {greeting}, {user?.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">Here is where things stand on {date(isoDate())}.</p>
      </div>

      <div data-tour="stats" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {fin ? (
          <>
            <StatCard label="Cash balance" value={money(fin.cash_balance)} hint="All Cash/Bank accounts" icon={Landmark} />
            <StatCard label="Money in" value={money(fin.money_in)} hint={`${money(fin.receivable)} still receivable`} icon={ArrowDownLeft} tone="success" />
            <StatCard label="Money out" value={money(fin.money_out)} hint={`${money(fin.payable)} still payable`} icon={ArrowUpRight} tone="danger" />
          </>
        ) : (
          <>
            <StatCard label="Projects" value={Number(ps.total)} hint={`${Number(ps.completed) || 0} completed`} icon={FolderKanban} />
            <StatCard label="Overdue projects" value={Number(ps.overdue) || 0} hint="Past their deadline" icon={Hourglass} tone="danger" />
            <StatCard label="Team members" value={Number(teamStats.total)} hint={`${Number(teamStats.active) || 0} active`} icon={UserSquare2} tone="info" />
          </>
        )}
        <StatCard label="Open tasks" value={openTasks} hint={`${totalTasks} tasks in total`} icon={ClipboardList} tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {fin && (
          <Card className="xl:col-span-2">
            <CardHeader title="Cash flow" description="Money received and paid per month" action={<ViewAll href="/transactions" />} />
            <div className="h-72 px-2 pt-4 pb-3">
              {chart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} barGap={6} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 4" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} dy={6} />
                    <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => money(v, { compact: true })} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--fg)", opacity: 0.04 }} />
                    <Bar dataKey="Money in" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                    <Bar dataKey="Money out" fill="color-mix(in srgb, var(--danger) 75%, transparent)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={Landmark} title="No transactions yet" hint="Record Money In or Money Out to see cash flow here." />
              )}
            </div>
            <div className="flex items-center gap-5 border-t border-line px-5 py-3 text-xs text-muted">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-brand" /> Money in
              </span>
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-danger/75" /> Money out
              </span>
            </div>
          </Card>
        )}

        <Card className={fin ? "" : "xl:col-span-1"}>
          <CardHeader title="Tasks by status" description={`${totalTasks} tasks`} action={<ViewAll href="/tasks" />} />
          {totalTasks ? (
            <div className="px-5 pt-2 pb-5">
              <div className="relative mx-auto h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={taskStats.map((t) => ({ name: t.status, value: Number(t.count) }))} dataKey="value" innerRadius={62} outerRadius={86} paddingAngle={3} strokeWidth={0}>
                      {taskStats.map((t) => (
                        <Cell key={t.status} fill={TASK_COLORS[t.status] || "var(--muted)"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="num text-3xl font-extrabold">{openTasks}</span>
                  <span className="text-xs text-muted">open</span>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {taskStats.map((t) => (
                  <li key={t.status} className="flex items-center gap-2.5 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: TASK_COLORS[t.status] || "var(--muted)" }} />
                    <span className="text-muted">{t.status}</span>
                    <span className="num ml-auto font-bold">{t.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState icon={ListChecks} title="No tasks yet" />
          )}
        </Card>

        <Card className={fin ? "xl:col-span-2" : "xl:col-span-2"}>
          <CardHeader
            title="Project summary"
            description={`${Number(ps.active) || 0} active, ${Number(ps.overdue) || 0} overdue, ${Number(ps.completed) || 0} completed`}
            action={<ViewAll href="/projects" />}
          />
          {projects.length ? (
            <ul className="mt-3 divide-y divide-line">
              {projects.map((p) => {
                const overdue = Number(p.percent_completed) < 100 && p.deadline && String(p.deadline).slice(0, 10) < isoDate();
                return (
                  <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-5 py-3.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{p.project_name}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        Due {date(p.deadline)}
                        {overdue && <Badge tone="danger">Overdue</Badge>}
                      </p>
                    </div>
                    <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                      <Progress value={p.percent_completed} tone={overdue ? "danger" : undefined} />
                      <span className="num w-10 text-right text-xs font-bold">{Number(p.percent_completed) || 0}%</span>
                    </div>
                    <p className="num col-start-2 row-start-1 text-right text-sm sm:col-start-3">
                      <span className="font-bold">{money(p.running_cost, { compact: true })}</span>
                      <span className="text-muted"> / {money(p.estimated_cost, { compact: true })}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={FolderKanban} title="No projects yet" />
          )}
        </Card>

        <Card>
          <CardHeader title="Pending tasks" description="Nearest deadlines first" action={<ViewAll href="/tasks" />} />
          {pendingTasks.length ? (
            <ul className="mt-3 divide-y divide-line">
              {pendingTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.task_name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {t.assigned_to_name || "Unassigned"} &middot; due {date(t.deadline)}
                    </p>
                  </div>
                  <StatusBadge value={t.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ListChecks} title="Nothing pending" hint="Every task is completed." />
          )}
        </Card>

        {fin && (
          <Card className="xl:col-span-3">
            <CardHeader title="Recent transactions" action={<ViewAll href="/transactions" />} />
            {fin.recent.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <tbody className="divide-y divide-line">
                    {fin.recent.map((t) => (
                      <tr key={t.id}>
                        <td className="w-px py-3 pr-2 pl-5">
                          <span className={`flex size-9 items-center justify-center rounded-full ${t.type === "money_in" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                            {t.type === "money_in" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                          </span>
                        </td>
                        <td className="px-3">
                          <p className="font-semibold">{t.party_name}</p>
                          <p className="text-xs text-muted">{t.for_what || "-"}</p>
                        </td>
                        <td className="num px-3 text-muted">{date(t.date)}</td>
                        <td className="px-3">
                          <StatusBadge value={t.status} />
                        </td>
                        <td className={`num py-3 pr-5 pl-3 text-right font-bold ${t.type === "money_in" ? "text-success" : "text-danger"}`}>
                          {t.type === "money_in" ? "+" : "-"}
                          {money(t.amount_now)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Landmark} title="No transactions yet" />
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
