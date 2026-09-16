import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { RecoveryRedirect } from "@/features/auth/recovery-redirect";

import "./globals.css";

const bodyFont = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body-family",
  display: "swap",
});

const headingFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading-family",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Autoprocs Dispatcher",
  description: "Disparador de mensagens em massa via WhatsApp Cloud API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${bodyFont.variable} ${headingFont.variable} ${monoFont.variable} font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <RecoveryRedirect />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
