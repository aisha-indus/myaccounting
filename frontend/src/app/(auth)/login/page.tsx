"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { api } from "@/lib/api";
import { type AuthUser, useAuth } from "@/lib/auth";
import { AuthForm, linkClass } from "../auth-form";

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to your workspace."
      schema={schema}
      notice={params.get("expired") ? "Your session expired. Please sign in again." : undefined}
      fields={[
        { name: "email", label: "Email", type: "email", placeholder: "you@company.com", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      extra={
        <div className="flex justify-end">
          <Link href="/forgot-password" className={`text-[13px] ${linkClass}`}>
            Forgot password?
          </Link>
        </div>
      }
      submitLabel="Sign in"
      onSubmit={async (values) => {
        const { data } = await api.post<{ token: string; user: AuthUser }>("/auth/login", values);
        signIn(data.token, data.user);
        router.replace("/dashboard");
      }}
      footer={
        <>
          New here?{" "}
          <Link href="/register" className={linkClass}>
            Create an account
          </Link>
        </>
      }
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
