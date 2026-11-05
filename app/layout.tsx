export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Ptex Management Dashboard",
  description: "Timesheet & MIS management for Ptex",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Fonts are loaded by the browser, not at compile time: the Google
            font loader downloads them on every dev compile and stalls on slow
            or blocked networks. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
