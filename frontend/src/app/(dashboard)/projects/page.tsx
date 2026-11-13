"use client";

import { CalendarDays, Clock } from "lucide-react";
import { RowActionButtons, ResourcePage } from "@/components/resource/resource-page";
import { Badge, Card, Progress } from "@/components/ui/primitives";
import { projects } from "@/config/resources";
import type { Row } from "@/hooks/use-resource";
import { date, isoDate, minutes, money } from "@/lib/format";

// TM-01-05: Active / Completed / Overdue
const done = (p: Row) => Number(p.percent_completed) >= 100;
const overdue = (p: Row) => !done(p) && !!p.deadline && String(p.deadline).slice(0, 10) < isoDate();
const active = (p: Row) => !done(p) && !overdue(p);

export default function ProjectsPage() {
  return (
    <ResourcePage
      config={projects}
      tabs={[
        { value: "all", label: "All" },
        { value: "active", label: "Active", filter: active },
        { value: "overdue", label: "Overdue", filter: overdue },
        { value: "completed", label: "Completed", filter: done },
      ]}
      renderCards={(rows, actions) => (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const spent = Number(p.estimated_cost) ? Math.round((Number(p.running_cost) / Number(p.estimated_cost)) * 100) : 0;
            return (
              <Card key={p.id} className="flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-bold tracking-tight">{p.project_name}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted">{[p.main_category, p.sub_category].filter(Boolean).join(" / ") || "Uncategorised"}</p>
                  </div>
                  <Badge tone={done(p) ? "success" : overdue(p) ? "danger" : p.type === "Client" ? "brand" : "neutral"} dot={done(p) || overdue(p)}>
                    {done(p) ? "Completed" : overdue(p) ? "Overdue" : p.type || "Project"}
                  </Badge>
                </div>

                <div className="mt-5">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-muted">Progress</span>
                    <span className="num text-sm font-bold">{Number(p.percent_completed) || 0}%</span>
                  </div>
                  <Progress value={p.percent_completed} tone={overdue(p) ? "danger" : undefined} />
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Running cost</dt>
                    <dd className="num mt-0.5 font-bold">{money(p.running_cost, { compact: true })}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Estimated cost</dt>
                    <dd className="num mt-0.5 font-bold">
                      {money(p.estimated_cost, { compact: true })} <span className={`text-xs font-semibold ${spent > 100 ? "text-danger" : "text-muted"}`}>({spent}%)</span>
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex items-center justify-between border-t border-line pt-3.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {date(p.deadline)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      {minutes(p.estimated_time)}
                    </span>
                  </div>
                  <RowActionButtons row={p} actions={actions} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    />
  );
}
