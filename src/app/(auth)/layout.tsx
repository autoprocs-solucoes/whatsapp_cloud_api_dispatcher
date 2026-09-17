import Link from "next/link";
import { Send } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-line bg-card px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-brand">
            <Send className="size-4 text-white" />
          </span>
          <span className="grid leading-tight">
            <span className="text-[13px] font-semibold text-ink">Autoprocs · Dispatcher</span>
            <span className="text-[11px] text-ink-3">Disparos WhatsApp</span>
          </span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
