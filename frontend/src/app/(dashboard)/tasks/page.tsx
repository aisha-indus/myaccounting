"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { TASK_STATUSES, tasks } from "@/config/resources";

export default function TasksPage() {
  return (
    <ResourcePage
      config={tasks}
      tabs={[{ value: "all", label: "All" }, ...TASK_STATUSES.map((s) => ({ value: s, label: s, filter: (t: Record<string, unknown>) => t.status === s }))]}
    />
  );
}
