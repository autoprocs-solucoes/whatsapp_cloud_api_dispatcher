import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContactsImportWizard } from "@/features/contacts/import-wizard";

export default function ImportarContatosPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/contatos">
            <ArrowLeft className="mr-1 size-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Importar contatos</h1>
        <p className="text-muted-foreground text-sm">
          Suba uma planilha (.xlsx ou .csv), mapeie as colunas e confirme.
        </p>
      </header>

      <ContactsImportWizard />
    </div>
  );
}
