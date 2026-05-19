import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="bg-background relative flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl text-center">
        <p className="text-primary mb-3 text-sm font-medium tracking-wide uppercase">
          Autoprocs · Dispatcher
        </p>
        <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Disparos de WhatsApp em escala, com a segurança da API oficial da Meta.
        </h1>
        <p className="text-muted-foreground mt-4 text-base sm:text-lg">
          Gerencie contatos, segmente sua base, dispare templates aprovados e acompanhe a entrega
          em um só lugar.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg" disabled>
            Entrar
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">
              Ver app
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
