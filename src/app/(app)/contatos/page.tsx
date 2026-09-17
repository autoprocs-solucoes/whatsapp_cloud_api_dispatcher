import Link from "next/link";
import { Download, Upload } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "@/features/contacts/contacts-table";
import { NewContactButton } from "@/features/contacts/new-contact-button";
import { listContacts } from "@/features/contacts/actions";

type SearchParams = Promise<{
  search?: string;
  optOutFilter?: string;
  pendingFilter?: string;
  page?: string;
  pageSize?: string;
}>;

export default async function ContatosPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { contacts, total, page, pageSize, pendingCounts } = await listContacts({
    search: sp.search,
    optOutFilter: (sp.optOutFilter as "all" | "active" | "opt_out" | undefined) ?? "all",
    pendingFilter:
      (sp.pendingFilter as "all" | "with_pending" | "without_pending" | undefined) ?? "all",
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
    <div className="space-y-5">
      <PageHeader
        title="Contatos"
        description="Importe via planilha, gerencie tags, campos custom e opt-outs."
        actions={
          <>
            {total > 0 && (
              <Button asChild variant="outline" size="sm">
                <a href={exportHref} download>
                  <Download className="size-4" /> Exportar CSV
                </a>
              </Button>
            )}
            <NewContactButton />
            <Button asChild size="sm">
              <Link href="/contatos/importar">
                <Upload className="size-4" /> Importar contatos
              </Link>
            </Button>
          </>
        }
      />

      <ContactsTable
        contacts={contacts}
        total={total}
        page={page}
        pageSize={pageSize}
        pendingCounts={pendingCounts}
      />
    </div>
  );
}
