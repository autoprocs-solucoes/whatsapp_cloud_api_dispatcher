import Link from "next/link";
import { Download, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContactsTable } from "@/features/contacts/contacts-table";
import { listContacts } from "@/features/contacts/actions";

type SearchParams = Promise<{
  search?: string;
  optOutFilter?: string;
  page?: string;
  pageSize?: string;
}>;

export default async function ContatosPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { contacts, total, page, pageSize } = await listContacts({
    search: sp.search,
    optOutFilter: (sp.optOutFilter as "all" | "active" | "opt_out" | undefined) ?? "all",
    page: sp.page ? Number(sp.page) : 1,
    pageSize: sp.pageSize ? Number(sp.pageSize) : 50,
  });

  const exportParams = new URLSearchParams();
  if (sp.search) exportParams.set("search", sp.search);
  if (sp.optOutFilter && sp.optOutFilter !== "all") {
    exportParams.set("optOutFilter", sp.optOutFilter);
  }
  const exportHref = `/contatos/export${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contatos</h1>
          <p className="text-muted-foreground text-sm">
            Importe contatos via planilha, gerencie campos custom e opt-outs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {total > 0 && (
            <Button asChild variant="outline">
              <a href={exportHref} download>
                <Download className="mr-1 size-4" /> Exportar CSV
              </a>
            </Button>
          )}
          <Button asChild>
            <Link href="/contatos/importar">
              <Upload className="mr-1 size-4" /> Importar contatos
            </Link>
          </Button>
        </div>
      </header>

      <ContactsTable contacts={contacts} total={total} page={page} pageSize={pageSize} />
    </div>
  );
}
