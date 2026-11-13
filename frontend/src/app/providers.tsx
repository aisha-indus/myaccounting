"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "var(--font-sans)", borderRadius: 12 } }}
      />
    </QueryClientProvider>
  );
}
