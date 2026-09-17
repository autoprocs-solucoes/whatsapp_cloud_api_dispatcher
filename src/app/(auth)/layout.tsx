import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-line bg-card px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/autoprocs-logo.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0"
          />
          <span className="text-[13px] font-semibold text-ink">Dispatcher</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
