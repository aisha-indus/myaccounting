import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { site } from "@/config/site";
import "./globals.css";
import { Providers } from "./providers";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans-loaded", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${site.name} - ${site.fullName}`, template: `%s | ${site.name}` },
  description: site.tagline,
};

// Applies the saved theme and accent before first paint so the page never flashes the wrong colours.
const themeScript = `try{var d=document.documentElement,t=localStorage.getItem("ibms_theme"),a=localStorage.getItem("ibms_accent");
if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.dataset.theme=t;if(a)d.dataset.accent=a;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
