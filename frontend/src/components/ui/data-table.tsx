"use client";

import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, Inbox, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { type ExportData, ExportMenu } from "./export-menu";
import { Card, EmptyState } from "./primitives";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    label?: string;
    align?: "left" | "right";
    /** Excluded from CSV export and the column picker (e.g. the actions column). */
    utility?: boolean;
  }
}

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  loading?: boolean;
  error?: string;
  searchPlaceholder?: string;
  /** Extra controls rendered next to the search box. */
  toolbar?: React.ReactNode;
  /** File name for exports. Omit to hide the export button. */
  exportName?: string;
  /** Heading printed on the PDF export. */
  exportTitle?: string;
  /** Column ids hidden until the user turns them on. */
  initialHidden?: string[];
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  searchPlaceholder = "Search...",
  toolbar,
  exportName,
  exportTitle,
  initialHidden = [],
  emptyTitle = "Nothing here yet",
  emptyHint,
  emptyAction,
}: DataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => Object.fromEntries(initialHidden.map((id) => [id, false])));

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  // Exports the visible columns of every filtered row, in the current sort order.
  const exportData = (): ExportData => {
    const cols = table.getVisibleLeafColumns().filter((c) => !c.columnDef.meta?.utility);
    return {
      headers: cols.map((c) => c.columnDef.meta?.label || c.id),
      rows: table.getSortedRowModel().rows.map((r) => cols.map((c) => r.getValue(c.id))),
    };
  };

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const from = total ? pageIndex * pageSize + 1 : 0;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <Card className="overflow-hidden">
      <div className="no-print flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-line bg-surface-2 pr-3 pl-9 text-sm outline-none transition placeholder:text-muted/70 focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/15"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <ColumnPicker table={table} />
          {exportName && <ExportMenu name={exportName} title={exportTitle || exportName} getData={exportData} disabled={!total} />}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-line bg-surface-2">
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const right = header.column.columnDef.meta?.align === "right";
                  return (
                    <th
                      key={header.id}
                      className={cn("h-11 px-4 text-[11px] font-bold tracking-wider whitespace-nowrap text-muted uppercase", right ? "text-right" : "text-left")}
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn("inline-flex items-center gap-1 uppercase transition hover:text-fg", right && "flex-row-reverse", sorted && "text-fg")}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3.5" /> : sorted === "desc" ? <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {table.getVisibleLeafColumns().map((c) => (
                      <td key={c.id} className="px-4 py-3.5">
                        <div className="skeleton h-4" style={{ width: `${45 + ((i * 17 + c.id.length * 11) % 45)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-brand/[0.035]">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn("px-4 py-3 whitespace-nowrap", cell.column.columnDef.meta?.align === "right" && "text-right", cell.column.id === "_actions" && "w-px")}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && !rows.length && (
          <EmptyState
            icon={Inbox}
            title={error ? "Could not load data" : globalFilter ? "No matches" : emptyTitle}
            hint={error || (globalFilter ? `Nothing matches "${globalFilter}".` : emptyHint)}
            action={!error && !globalFilter ? emptyAction : undefined}
          />
        )}
      </div>

      <div className="no-print flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="num">
            {from}-{to} of {total}
          </span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-fg outline-none focus:border-brand"
            aria-label="Rows per page"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <span className="num px-2">
            Page {pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <Button variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ColumnPicker<T>({ table }: { table: ReturnType<typeof useReactTable<T>> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const cols = table.getAllLeafColumns().filter((c) => !c.columnDef.meta?.utility);
  if (cols.length < 6) return null;

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
        <Columns3 className="size-4" />
        Columns
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 max-h-80 w-56 animate-pop overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-pop">
          {cols.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-fg/5">
              <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} className="size-4 accent-(--brand)" />
              {c.columnDef.meta?.label || c.id}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
