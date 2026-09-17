import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// 404 global — também é o que o gate do Master devolve (notFound()) pra quem
// não é superadmin, então tem que parecer uma página normal do app.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper p-6 text-center">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-card p-8 shadow-card">
        <Image src="/meta-logo.png" alt="" width={32} height={32} className="mx-auto" />
        <p className="label-caps">Erro 404</p>
        <h1 className="text-[23px] leading-tight font-semibold tracking-tight text-ink">
          Página não encontrada
        </h1>
        <p className="text-sm text-ink-2">
          O endereço não existe ou você não tem acesso a ele.
        </p>
        <Button asChild size="sm">
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
