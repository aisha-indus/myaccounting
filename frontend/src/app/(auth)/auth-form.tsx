"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { type FieldValues, type Path, useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { errorMessage } from "@/lib/api";

export interface AuthField {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  placeholder?: string;
  autoComplete?: string;
}

interface AuthFormProps<T extends FieldValues> {
  title: string;
  subtitle: string;
  schema: z.ZodType<T>;
  fields: AuthField[];
  submitLabel: string;
  /** Returns a success message to show instead of the form, or nothing if the page navigates away. */
  onSubmit: (values: T) => Promise<string | void>;
  /** Rendered between the fields and the button (e.g. "Forgot password?"). */
  extra?: React.ReactNode;
  footer?: React.ReactNode;
  notice?: string;
}

/** Shared form for the sign in, register, forgot and reset password screens. */
export function AuthForm<T extends FieldValues>({ title, subtitle, schema, fields, submitLabel, onSubmit, extra, footer, notice }: AuthFormProps<T>) {
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<T>({ resolver: zodResolver(schema as any) as any });

  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      const message = await onSubmit(values);
      if (message) setDone(message);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <div>
      <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>

      {done ? (
        <div className="mt-8 flex gap-3 rounded-xl border border-success/25 bg-success/10 p-4 text-sm font-medium text-success">
          <CheckCircle2 className="size-5 shrink-0" />
          {done}
        </div>
      ) : (
        <form onSubmit={submit} method="post" noValidate className="mt-8 space-y-4">
          {notice && <div className="rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-[13px] font-medium text-warning">{notice}</div>}
          {fields.map((f) => (
            <Field key={f.name} label={f.label} error={errors[f.name]?.message as string | undefined}>
              <div className="relative">
                <Input
                  type={f.type === "password" && show ? "text" : f.type}
                  placeholder={f.placeholder}
                  autoComplete={f.autoComplete}
                  aria-invalid={!!errors[f.name]}
                  className={f.type === "password" ? "h-11 pr-11" : "h-11"}
                  {...register(f.name as Path<T>)}
                />
                {f.type === "password" && (
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-fg"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                )}
              </div>
            </Field>
          ))}
          {extra}
          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-[13px] font-medium text-danger">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </p>
          )}
          <Button type="submit" loading={isSubmitting} className="h-11 w-full">
            {submitLabel}
          </Button>
        </form>
      )}

      {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}

export const linkClass = "font-semibold text-brand-text hover:underline";
