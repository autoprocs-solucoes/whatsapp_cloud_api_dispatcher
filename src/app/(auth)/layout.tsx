import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="bg-primary/25 motion-safe:[animation:blob-float_22s_ease-in-out_infinite] absolute -top-24 -left-24 size-96 rounded-full blur-3xl"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="bg-primary/15 motion-safe:[animation:blob-float_26s_ease-in-out_infinite] absolute top-1/3 -right-32 size-[28rem] rounded-full blur-3xl"
          style={{ animationDelay: "-8s" }}
        />
        <div
          className="bg-primary/10 motion-safe:[animation:blob-float_19s_ease-in-out_infinite] absolute -bottom-32 left-1/4 size-96 rounded-full blur-3xl"
          style={{ animationDelay: "-4s" }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/meta-logo.png" alt="" width={20} height={20} />
          <span className="font-heading font-semibold">Autoprocs Dispatcher</span>
        </Link>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="animate-in fade-in slide-in-from-bottom-2 w-full max-w-md duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
