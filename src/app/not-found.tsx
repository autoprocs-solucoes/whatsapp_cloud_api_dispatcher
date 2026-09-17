import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// 404 global com a marca — também é o que o gate do Master devolve
// (notFound()) pra quem não é superadmin, então tem que parecer uma página
// normal do app, sem revelar nada.
export default function NotFound() {
  return (
    <div className="bg-muted/30 relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-primary/20 motion-safe:[animation:blob-float_22s_ease-in-out_infinite] absolute -top-24 -left-24 size-96 rounded-full blur-3xl" />
        <div className="bg-primary/10 motion-safe:[animation:blob-float_26s_ease-in-out_infinite] absolute -right-32 -bottom-32 size-[28rem] rounded-full blur-3xl" />
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-2 relative z-10 space-y-4 duration-500">
        <Image src="/meta-logo.png" alt="" width={40} height={40} className="mx-auto opacity-80" />
        <p className="text-muted-foreground font-mono text-xs">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          O endereço não existe ou você não tem acesso a ele.
        </p>
        <Button asChild>
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
