"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { api } from "@/lib/api";
import { type AuthUser, useAuth } from "@/lib/auth";
import { AuthForm, linkClass } from "../auth-form";

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  return (
    <AuthForm
      title="Create your account"
      subtitle="New accounts start with the client role. An admin can change it later."
      schema={schema}
      fields={[
        { name: "name", label: "Full name", type: "text", autoComplete: "name" },
        { name: "email", label: "Email", type: "email", placeholder: "you@company.com", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
        { name: "confirm", label: "Confirm password", type: "password", autoComplete: "new-password" },
      ]}
      submitLabel="Create account"
      onSubmit={async ({ name, email, password }) => {
        const { data } = await api.post<{ token: string; user: AuthUser }>("/auth/register", { name, email, password });
        signIn(data.token, data.user);
        router.replace("/dashboard");
      }}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={linkClass}>
            Sign in
          </Link>
        </>
      }
    />
  );
}
