"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, LayoutGrid, List, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { type Row, useList, useRemove, useSave } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Button } from "../ui/button";
import { DataTable } from "../ui/data-table";
import { ConfirmDelete, Modal } from "../ui/modal";
import { PageHeader, Tabs } from "../ui/primitives";
import { fieldValue, renderCol } from "./cells";
import { ResourceForm, toPayload } from "./resource-form";
import type { ResourceConfig } from "./types";

type Dialog = { mode: "create" | "edit" | "view" | "delete"; row?: Row } | null;

export interface RowActions {
  view: (row: Row) => void;
  edit: (row: Row) => void;
  remove: (row: Row) => void;
  canWrite: boolean;
}

/**
 * Add / edit / view / delete dialogs for a resource. Used by ResourcePage and by the
 * custom screens (ledger, transactions) so every module behaves the same way.
 */
export function useResourceDialogs(config: ResourceConfig) {
  const { canEdit } = useAuth();
  // The resource key is also its module key, so Module Access decides who may change records here.
  const canWrite = !config.readOnly && canEdit(config.key);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [formError, setFormError] = useState("");
  const save = useSave(config.key);
  const remove = useRemove(config.key);

  const close = useCallback(() => {
    setDialog(null);
    setFormError("");
  }, []);

  const actions: RowActions & { create: () => void } = useMemo(
    () => ({
      create: () => setDialog({ mode: "create" }),
      view: (row) => setDialog({ mode: "view", row }),
      edit: (row) => setDialog({ mode: "edit", row }),
      remove: (row) => setDialog({ mode: "delete", row }),
      canWrite,
    }),
    [canWrite]
  );

  const submit = (values: Row) => {
    setFormError("");
    save.mutate(
      { id: dialog?.row?.id, payload: toPayload(config.fields, values, config.multipart) },
      {
        onSuccess: () => {
          toast.success(`${config.singular} ${dialog?.mode === "edit" ? "updated" : "created"}`);
          close();
        },
        onError: (e) => setFormError(errorMessage(e)),
      }
    );
  };

  const isForm = dialog?.mode === "create" || dialog?.mode === "edit";
  const row = dialog?.row;
  const size = config.formSize || "md";

  const dialogs = (
    <>
      <Modal
        open={isForm}
        onClose={close}
        size={size}
        title={dialog?.mode === "edit" ? `Edit ${config.singular.toLowerCase()}` : `New ${config.singular.toLowerCase()}`}
        description={dialog?.mode === "edit" && row ? config.rowLabel(row) : undefined}
      >
        {isForm && (
          <ResourceForm
            fields={config.fields}
            row={dialog?.mode === "edit" ? row : undefined}
            defaults={config.defaults?.()}
            cols={size === "xl" ? 3 : 2}
            summary={config.formSummary}
            submitting={save.isPending}
            error={formError}
            onSubmit={submit}
            onCancel={close}
          />
        )}
      </Modal>

      <Modal open={dialog?.mode === "view"} onClose={close} size={size === "md" ? "md" : "lg"} title={row ? config.rowLabel(row) : ""} description={`${config.singular} details`}>
        {row && (
          <>
            <dl className="grid gap-x-8 gap-y-4 px-6 py-5 sm:grid-cols-2">
              {config.fields
                .filter((f) => f.type !== "password" && f.type !== "file")
                .map((f) => (
                  <div key={f.name} className={cn("min-w-0", (f.type === "textarea" || f.type === "multicheck") && "sm:col-span-2")}>
                    <dt className="text-xs font-medium text-muted">{f.label}</dt>
                    <dd className="mt-1 text-sm font-medium break-words whitespace-normal">{fieldValue(f, row)}</dd>
                  </div>
                ))}
            </dl>
            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
              <Button variant="secondary" onClick={close}>
                Close
              </Button>
              {canWrite && (
                <Button onClick={() => setDialog({ mode: "edit", row })}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>

      <ConfirmDelete
        open={dialog?.mode === "delete"}
        label={row ? config.rowLabel(row) : ""}
        loading={remove.isPending}
        onCancel={close}
        onConfirm={() =>
          row &&
          remove.mutate(row.id, {
            onSuccess: () => {
              toast.success(`${config.singular} deleted`);
              close();
            },
            onError: (e) => {
              toast.error(errorMessage(e));
              close();
            },
          })
        }
      />
    </>
  );

  return { actions, dialogs, canWrite };
}

export function RowActionButtons({ row, actions, noView }: { row: Row; actions: RowActions; noView?: boolean }) {
  const btn = "flex size-8 items-center justify-center rounded-lg text-muted transition";
  return (
    <div className="flex items-center justify-end gap-0.5">
      {!noView && (
        <button type="button" title="View" aria-label="View" onClick={() => actions.view(row)} className={cn(btn, "hover:bg-fg/5 hover:text-fg")}>
          <Eye className="size-4" />
        </button>
      )}
      {actions.canWrite && (
        <>
          <button type="button" title="Edit" aria-label="Edit" onClick={() => actions.edit(row)} className={cn(btn, "hover:bg-brand/10 hover:text-brand-text")}>
            <Pencil className="size-4" />
          </button>
          <button type="button" title="Delete" aria-label="Delete" onClick={() => actions.remove(row)} className={cn(btn, "hover:bg-danger/10 hover:text-danger")}>
            <Trash2 className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}

export interface TabDef {
  value: string;
  label: string;
  filter?: (row: Row) => boolean;
}

interface ResourcePageProps {
  config: ResourceConfig;
  /** Quick filters shown as pills above the table. The first one is selected by default. */
  tabs?: TabDef[];
  /** Optional card layout. When given, a table/cards switch appears. */
  renderCards?: (rows: Row[], actions: RowActions) => React.ReactNode;
  /** Extra header buttons, left of "Add". */
  headerActions?: React.ReactNode;
  /** Content between the header and the table (stat cards, notices). */
  children?: React.ReactNode | ((rows: Row[]) => React.ReactNode);
}

export function ResourcePage({ config, tabs, renderCards, headerActions, children }: ResourcePageProps) {
  const { data = [], isLoading, error } = useList(config.key);
  const { actions, dialogs, canWrite } = useResourceDialogs(config);
  const [tab, setTab] = useState(tabs?.[0]?.value || "");
  const [view, setView] = useState<"table" | "cards">(renderCards ? "cards" : "table");

  const rows = useMemo(() => {
    const active = tabs?.find((t) => t.value === tab);
    return active?.filter ? data.filter(active.filter) : data;
  }, [data, tabs, tab]);

  const columns = useMemo<ColumnDef<Row, any>[]>(
    () => [
      ...config.columns.map(
        (col): ColumnDef<Row, any> => ({
          id: col.key,
          accessorFn: (row) => row[col.key],
          header: col.header,
          cell: ({ row }) => renderCol(col, row.original),
          meta: { label: col.header, align: col.type === "money" || col.type === "number" || col.type === "percent" ? "right" : "left" },
        })
      ),
      {
        id: "_actions",
        header: "",
        enableSorting: false,
        enableGlobalFilter: false,
        meta: { utility: true, align: "right" },
        cell: ({ row }) => <RowActionButtons row={row.original} actions={actions} />,
      },
    ],
    [config.columns, actions]
  );

  const addButton = canWrite && (
    <Button onClick={actions.create}>
      <Plus className="size-4" />
      Add {config.singular.toLowerCase()}
    </Button>
  );

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            {headerActions}
            {addButton}
          </>
        }
      />

      {typeof children === "function" ? children(data) : children}

      {(tabs || renderCards) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {tabs ? (
            <Tabs
              value={tab}
              onChange={setTab}
              items={tabs.map((t) => ({ value: t.value, label: t.label, count: t.filter ? data.filter(t.filter).length : data.length }))}
            />
          ) : (
            <span />
          )}
          {renderCards && (
            <div className="no-print inline-flex rounded-xl border border-line bg-surface p-1 shadow-card">
              {(
                [
                  ["cards", LayoutGrid, "Cards"],
                  ["table", List, "Table"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={cn("flex size-8 items-center justify-center rounded-lg transition", view === value ? "bg-brand text-white" : "text-muted hover:text-fg")}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "cards" && renderCards && !isLoading && rows.length > 0 ? (
        renderCards(rows, actions)
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          error={error ? errorMessage(error) : undefined}
          searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
          exportName={config.key}
          exportTitle={config.title}
          initialHidden={config.columns.filter((c) => c.hidden).map((c) => c.key)}
          emptyTitle={`No ${config.title.toLowerCase()} yet`}
          emptyHint={canWrite ? `Add your first ${config.singular.toLowerCase()} to get started.` : undefined}
          emptyAction={addButton || undefined}
        />
      )}

      {dialogs}
    </>
  );
}
