"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, FileText } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Controller, type Control, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { type Row, useList } from "@/hooks/use-resource";
import { FILES_URL } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "../ui/button";
import { Field as FieldWrap, Input, Select, Switch, Textarea } from "../ui/form";
import type { Field } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMERIC = ["number", "money", "relation"];

/** Builds the Zod schema for a form from its field definitions. */
export function buildSchema(fields: Field[], isEdit: boolean) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    const need = `${f.label} is required`;
    if (NUMERIC.includes(f.type)) {
      const base = z.number({ error: need }).min(f.min ?? (f.type === "relation" ? 1 : 0), `${f.label} cannot be less than ${f.min ?? 0}`);
      shape[f.name] = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), f.required ? base : base.nullable());
    } else if (f.type === "boolean") {
      shape[f.name] = z.boolean();
    } else if (f.type === "multicheck") {
      shape[f.name] = f.required ? z.array(z.string()).min(1, `Select at least one ${f.label.toLowerCase()}`) : z.array(z.string());
    } else if (f.type === "file") {
      shape[f.name] = z.any();
    } else if (f.type === "password") {
      // Required when creating; when editing, blank means "keep the current password".
      const strong = z.string().min(8, "Use at least 8 characters");
      shape[f.name] = isEdit ? z.union([z.literal(""), strong]) : strong;
    } else {
      let s = z.string().trim();
      if (f.required) s = s.min(1, need);
      if (f.type === "email") shape[f.name] = s.refine((v) => !v || EMAIL.test(v), "Enter a valid email address");
      else if (f.type === "url") shape[f.name] = s.refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Start with http:// or https://");
      else shape[f.name] = s;
    }
  }
  return z.object(shape);
}

/** Converts a database row into form values (inputs need strings in specific formats). */
export function toFormValues(fields: Field[], row: Row | undefined, defaults: Row = {}): Row {
  const values: Row = {};
  for (const f of fields) {
    const raw = row ? row[f.name] : defaults[f.name];
    switch (f.type) {
      case "boolean":
        values[f.name] = !!Number(raw);
        break;
      case "multicheck":
        values[f.name] = raw ? String(raw).split(",").map((s) => s.trim()).filter(Boolean) : [];
        break;
      case "date":
        values[f.name] = raw ? String(raw).slice(0, 10) : "";
        break;
      case "month":
        values[f.name] = raw ? String(raw).slice(0, 7) : "";
        break;
      case "datetime":
        values[f.name] = raw ? String(raw).replace(" ", "T").slice(0, 16) : "";
        break;
      case "time":
        values[f.name] = raw ? String(raw).slice(0, 5) : "";
        break;
      case "password":
      case "file":
        values[f.name] = f.type === "file" ? undefined : "";
        break;
      default:
        values[f.name] = raw === null || raw === undefined ? "" : NUMERIC.includes(f.type) ? raw : String(raw);
    }
  }
  return values;
}

/** Converts validated form values into the request body (JSON, or FormData when files are involved). */
export function toPayload(fields: Field[], values: Row, multipart?: boolean): Row | FormData {
  const out: Row = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === "file") {
      const file = v instanceof FileList ? v[0] : undefined;
      if (file) out[f.name] = file;
    } else if (f.type === "multicheck") out[f.name] = (v as string[]).join(",");
    else if (f.type === "password") {
      if (v) out[f.name] = v;
    } else out[f.name] = v === "" || v === undefined ? null : v;
  }
  if (!multipart) return out;
  const form = new FormData();
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof File) form.append(k, v);
    else form.append(k, v === null ? "" : typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return form;
}

interface ResourceFormProps {
  fields: Field[];
  /** Row being edited. Omit to create. */
  row?: Row;
  defaults?: Row;
  cols?: 2 | 3;
  submitLabel?: string;
  submitting?: boolean;
  /** Server-side error to show above the buttons. */
  error?: string;
  summary?: (values: Row) => { label: string; value: string; strong?: boolean }[];
  onSubmit: (values: Row) => void;
  onCancel: () => void;
}

export function ResourceForm({ fields: allFields, row, defaults, cols = 2, submitLabel, submitting, error, summary, onSubmit, onCancel }: ResourceFormProps) {
  const isEdit = !!row;
  const fields = useMemo(() => allFields.filter((f) => !f.only || f.only === (isEdit ? "edit" : "create")), [allFields, isEdit]);
  const schema = useMemo(() => buildSchema(fields, isEdit), [fields, isEdit]);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Row>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as any,
    defaultValues: toFormValues(fields, row, defaults),
  });

  // Ctrl/Cmd + S saves the form (SRS 5.3).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sections = useMemo(() => {
    const list: { title: string; fields: Field[] }[] = [];
    for (const f of fields) {
      const title = f.section || "";
      const last = list[list.length - 1];
      if (last && last.title === title) last.fields.push(f);
      else list.push({ title, fields: [f] });
    }
    return list;
  }, [fields]);

  const grid = cols === 3 ? "grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-x-5 gap-y-4 sm:grid-cols-2";

  const input = (f: Field) => {
    const invalid = !!errors[f.name];
    const common = { "aria-invalid": invalid, placeholder: f.placeholder };
    switch (f.type) {
      case "textarea":
        return <Textarea {...common} {...register(f.name)} />;
      case "select":
        return <SelectField field={f} control={control} invalid={invalid} />;
      case "relation":
        return <RelationField field={f} control={control} invalid={invalid} />;
      case "boolean":
        return <Controller name={f.name} control={control} render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label={f.label} />} />;
      case "multicheck":
        return (
          <Controller
            name={f.name}
            control={control}
            render={({ field }) => {
              const selected: string[] = field.value || [];
              return (
                <div className="flex flex-wrap gap-2">
                  {f.options!.map((opt) => {
                    const on = selected.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={on}
                        onClick={() => field.onChange(on ? selected.filter((s) => s !== opt) : [...selected, opt])}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition",
                          on ? "border-brand bg-brand/10 text-brand-text" : "border-line text-muted hover:border-fg/25 hover:text-fg"
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              );
            }}
          />
        );
      case "file":
        return (
          <div>
            <input
              type="file"
              accept={f.accept}
              {...register(f.name)}
              className="block w-full cursor-pointer rounded-lg border border-dashed border-line bg-surface-2 text-[13px] text-muted file:mr-3 file:cursor-pointer file:border-0 file:bg-brand/10 file:px-3 file:py-2.5 file:text-[13px] file:font-semibold file:text-brand-text hover:border-brand/50"
            />
            {row?.[f.name] && (
              <a href={`${FILES_URL}${row[f.name]}`} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-text hover:underline">
                <FileText className="size-3.5" /> View current file
              </a>
            )}
          </div>
        );
      case "money":
      case "number":
        return <Input type="number" inputMode="decimal" step={f.type === "money" ? "0.01" : "any"} min={f.min ?? 0} className="num" {...common} {...register(f.name)} />;
      case "datetime":
        return <Input type="datetime-local" {...common} {...register(f.name)} />;
      case "password":
        return <Input type="password" autoComplete="new-password" {...common} {...register(f.name)} />;
      default:
        return <Input type={f.type === "url" ? "text" : f.type} {...common} {...register(f.name)} />;
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} method="post" noValidate className="flex min-h-0 flex-col">
      <div className="space-y-7 px-6 py-5">
        {sections.map((section, i) => (
          <fieldset key={section.title || i}>
            {section.title && (
              <legend className="mb-3.5 flex w-full items-center gap-3 text-[11px] font-bold tracking-widest text-muted uppercase">
                {section.title}
                <span className="h-px flex-1 bg-line" />
              </legend>
            )}
            <div className={grid}>
              {section.fields.map((f) => {
                const wide = f.wide || f.type === "textarea" || f.type === "multicheck";
                const message = errors[f.name]?.message as string | undefined;
                // Switches and chip groups contain buttons, so they must not sit inside a <label>.
                if (f.type === "boolean" || f.type === "multicheck") {
                  return (
                    <div key={f.name} className={cn(wide && "col-span-full")}>
                      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold">
                        {f.label}
                        {f.required && <span className="text-danger">*</span>}
                      </span>
                      {input(f)}
                      {message ? <span className="mt-1 block text-xs font-medium text-danger">{message}</span> : f.help && <span className="mt-1 block text-xs text-muted">{f.help}</span>}
                    </div>
                  );
                }
                return (
                  <FieldWrap key={f.name} label={f.label} required={f.required && !(isEdit && f.type === "password")} error={message} help={f.help} className={cn(wide && "col-span-full")}>
                    {input(f)}
                  </FieldWrap>
                );
              })}
            </div>
          </fieldset>
        ))}
        {summary && <Summary control={control} compute={summary} />}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-b-2xl">
        {error ? (
          <p className="flex items-center gap-2 text-[13px] font-medium text-danger">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        ) : (
          <p className="hidden text-xs text-muted sm:block">
            <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">Ctrl</kbd> +{" "}
            <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">S</kbd> to save
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitLabel || (isEdit ? "Save changes" : "Create")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Summary({ control, compute }: { control: Control<Row>; compute: NonNullable<ResourceFormProps["summary"]> }) {
  const values = useWatch({ control });
  const items = compute(values);
  return (
    <div className="grid gap-3 rounded-xl border border-line bg-surface-2 p-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs font-medium text-muted">{item.label}</p>
          <p className={cn("num mt-0.5 font-bold", item.strong ? "text-lg text-brand-text" : "text-base")}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function SelectField({ field: f, control, invalid }: { field: Field; control: Control<Row>; invalid: boolean }) {
  const parent = useWatch({ control, name: f.dependsOn?.field || "__none__" });
  return (
    <Controller
      name={f.name}
      control={control}
      render={({ field }) => {
        const base = f.dependsOn ? f.dependsOn.map[parent as string] || [] : f.options || [];
        // Keep a stored value selectable even if it is not one of the preset options.
        const options = field.value && !base.includes(field.value) ? [...base, field.value] : base;
        return (
          <Select aria-invalid={invalid} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur}>
            <option value="">{f.dependsOn && !parent ? `Choose ${f.dependsOn.field.replace(/_/g, " ")} first` : "Select..."}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        );
      }}
    />
  );
}

function RelationField({ field: f, control, invalid }: { field: Field; control: Control<Row>; invalid: boolean }) {
  // Dropdown choices come from the lookup endpoint, which works even when the user's role cannot open that module.
  const { data = [], isLoading } = useList(`lookup/${f.relation!.resource}`);
  const rows = f.relation!.filter ? data.filter(f.relation!.filter) : data;
  return (
    <Controller
      name={f.name}
      control={control}
      render={({ field }) => (
        <Select aria-invalid={invalid} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur}>
          <option value="">{isLoading ? "Loading..." : "Select..."}</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {f.relation!.label(r)}
            </option>
          ))}
        </Select>
      )}
    />
  );
}
