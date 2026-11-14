"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } }));

  // The inline script in layout.tsx sets the theme before paint. In development React's Strict Mode
  // remount clears attributes on <html>, so they are applied again here (a no-op in production).
  useLayoutEffect(() => {
    const d = document.documentElement;
    try {
      const theme = localStorage.getItem("ibms_theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const accent = localStorage.getItem("ibms_accent");
      if (d.dataset.theme !== theme) d.dataset.theme = theme;
      if (accent && d.dataset.accent !== accent) d.dataset.accent = accent;
    } catch {
      /* storage unavailable: keep the default theme */
    }
  }, []);
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
