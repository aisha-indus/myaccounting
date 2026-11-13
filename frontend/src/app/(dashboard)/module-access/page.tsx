"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Fragment } from "react";
import { toast } from "sonner";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { Level } from "@/lib/auth";
import { cn } from "@/lib/cn";

interface Matrix {
  modules: { key: string; label: string; group: string; readOnly: boolean }[];
  roles: { id: number; role_name: string; locked: boolean; access: Record<string, Level> }[];
}

const LABELS: Record<Level, string> = { none: "Off", view: "View", full: "Full" };
const TONES: Record<Level, string> = {
  none: "border-line bg-surface-2 text-muted",
  view: "border-info/30 bg-info/10 text-info",
  full: "border-success/30 bg-success/10 text-success",
};

/** UM-03-03: a super admin switches each module off, to view-only, or fully on for every role. */
export default function ModuleAccessPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["role-access"], queryFn: async () => (await api.get<Matrix>("/role-access")).data, retry: false });

  const set = useMutation({
    mutationFn: async (v: { role_id: number; module_key: string; access: Level }) => api.put("/role-access", v),
    onSuccess: (_res, v) => {
      const role = data?.roles.find((r) => r.id === v.role_id)?.role_name;
      const mod = data?.modules.find((m) => m.key === v.module_key)?.label;
      toast.success(`${mod} is now "${LABELS[v.access]}" for ${role}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries(),
  });

  const reset = useMutation({
    mutationFn: async (roleId: number) => api.delete(`/role-access/${roleId}`),
    onSuccess: () => toast.success("Role is back to the default access"),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries(),
  });

  const groups = data ? [...new Set(data.modules.map((m) => m.group))] : [];

  return (
    <>
      <PageHeader title="Module Access" description="Choose what each role can do in every module. Changes apply straight away, no sign-in needed." />

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted">
        {(["none", "view", "full"] as Level[]).map((l) => (
          <span key={l} className="flex items-center gap-2">
            <span className={cn("rounded-md border px-2 py-0.5 text-xs font-bold", TONES[l])}>{LABELS[l]}</span>
            {l === "none" ? "Hidden from the menu and blocked" : l === "view" ? "Can open and read only" : "Can add, edit and delete"}
          </span>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-9" />
            ))}
          </div>
        ) : error || !data ? (
          <EmptyState icon={SlidersHorizontal} title="Could not load module access" hint={error ? errorMessage(error) : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="sticky left-0 z-10 h-14 min-w-44 bg-surface-2 px-5 text-left text-[11px] font-bold tracking-wider text-muted uppercase">Module</th>
                  {data.roles.map((r) => (
                    <th key={r.id} className="min-w-28 px-2 text-center">
                      <span className="block text-xs font-bold capitalize">{r.role_name.replace("-", " ")}</span>
                      {r.locked ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                          <Lock className="size-3" /> always full
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => reset.mutate(r.id)}
                          title="Back to the default access for this role"
                          className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-brand-text"
                        >
                          <RotateCcw className="size-3" /> reset
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group}>
                    <tr className="border-b border-line">
                      <td colSpan={data.roles.length + 1} className="bg-surface px-5 pt-4 pb-1.5 text-[11px] font-bold tracking-widest text-muted uppercase">
                        {group}
                      </td>
                    </tr>
                    {data.modules
                      .filter((m) => m.group === group)
                      .map((m) => (
                        <tr key={m.key} className="border-b border-line hover:bg-brand/[0.03]">
                          <td className="sticky left-0 z-10 bg-surface px-5 py-2 font-semibold whitespace-nowrap">
                            {m.label}
                            {m.readOnly && <span className="ml-2 text-[11px] font-medium text-muted">view only</span>}
                          </td>
                          {data.roles.map((r) => {
                            const value = r.access[m.key] || "none";
                            return (
                              <td key={r.id} className="px-2 py-2 text-center">
                                {r.locked ? (
                                  <span className={cn("inline-block w-20 rounded-md border py-1 text-xs font-bold", TONES.full)}>Full</span>
                                ) : (
                                  <select
                                    value={value}
                                    aria-label={`${m.label} access for ${r.role_name}`}
                                    onChange={(e) => set.mutate({ role_id: r.id, module_key: m.key, access: e.target.value as Level })}
                                    className={cn("h-8 w-20 cursor-pointer rounded-md border px-1.5 text-center text-xs font-bold outline-none transition focus:ring-4 focus:ring-brand/15", TONES[value])}
                                  >
                                    <option value="none">Off</option>
                                    <option value="view">View</option>
                                    {!m.readOnly && <option value="full">Full</option>}
                                  </select>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
