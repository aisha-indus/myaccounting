"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { api } from "@/lib/api";
import { AuthForm, linkClass } from "../auth-form";

const schema = z
  .object({ password: z.string().min(8, "Use at least 8 characters"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  return (
    <AuthForm
      title="Choose a new password"
      subtitle="Use at least 8 characters."
      schema={schema}
      notice={token ? undefined : "This link is missing its token. Open the link from your email again."}
      fields={[
        { name: "password", label: "New password", type: "password", autoComplete: "new-password" },
        { name: "confirm", label: "Confirm password", type: "password", autoComplete: "new-password" },
      ]}
      submitLabel="Update password"
      onSubmit={async ({ password }) => (await api.post<{ message: string }>("/auth/reset-password", { token, password })).data.message}
      footer={
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      }
    />
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
