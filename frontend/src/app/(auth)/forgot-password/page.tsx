"use client";

import Link from "next/link";
import { z } from "zod";
import { api } from "@/lib/api";
import { AuthForm, linkClass } from "../auth-form";

const schema = z.object({ email: z.email("Enter a valid email address") });

export default function ForgotPasswordPage() {
  return (
    <AuthForm
      title="Forgot your password?"
      subtitle="Enter your email and we will send a reset link. It stays valid for 60 minutes."
      schema={schema}
      fields={[{ name: "email", label: "Email", type: "email", placeholder: "you@company.com", autoComplete: "email" }]}
      submitLabel="Send reset link"
      onSubmit={async (values) => (await api.post<{ message: string }>("/auth/forgot-password", values)).data.message}
      footer={
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      }
    />
  );
}
