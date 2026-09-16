import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { listWorkspacesForMaster, requireMasterUser } from "@/server/master";

function healthBadgeVariant(status: string | null): "default" | "secondary" | "destructive" {
  switch (status) {
    case "AVAILABLE":
      return "default";
    case "LIMITED":
      return "secondary";
    case "BLOCKED":
      return "destructive";
    default:
      return "secondary";
  }
}

export default async function MasterPage() {
  await requireMasterUser();
  const workspaces = await listWorkspacesForMaster();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Image src="/meta-logo.png" alt="" width={22} height={22} />
          Master
        </h1>
        <p className="text-muted-foreground text-sm">
          Visão cross-tenant de todos os clientes (workspaces) da plataforma. Clique num cliente
          pra ver o overview completo.
        </p>
      </header>

      <div className="text-muted-foreground text-sm">
        {workspaces.length} cliente(s) no total.
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nome cliente</th>
              <th className="px-3 py-2 text-left font-medium">Owner principal</th>
              <th className="px-3 py-2 text-right font-medium">Membros</th>
              <th className="px-3 py-2 text-right font-medium">Disparos</th>
              <th className="px-3 py-2 text-left font-medium">Conexão Meta</th>
              <th className="px-3 py-2 text-left font-medium">Coexistência</th>
              <th className="px-3 py-2 text-left font-medium">Criado desde</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-3 py-8 text-center">
                  Nenhum workspace cadastrado.
                </td>
              </tr>
            ) : (
              workspaces.map((w) => {
                const hasCoexistence = w.connections.some((c) => c.isCoexistence);
                return (
                  <tr key={w.id} className="hover:bg-muted/20 border-t align-top">
                    <td className="px-3 py-2">
                      <Link href={`/master/${w.id}`} className="font-medium hover:underline">
                        {w.name}
                      </Link>
                      <p className="text-muted-foreground text-[10px]">{w.slug}</p>
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {w.ownerEmail ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{w.memberCount}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {w.totalSent.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      {w.connections.length === 0 ? (
                        <span className="text-muted-foreground text-xs">Sem conexão</span>
                      ) : (
                        <div className="space-y-1">
                          {w.connections.map((c) => (
                            <div key={c.id} className="flex items-center gap-1.5">
                              <Badge
                                variant={healthBadgeVariant(c.canSendMessage)}
                                className="text-[10px]"
                              >
                                {c.canSendMessage ?? "—"}
                              </Badge>
                              <span className="text-xs">{c.businessName ?? c.wabaId}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={hasCoexistence ? "default" : "outline"} className="text-[10px]">
                        {hasCoexistence ? "Sim" : "Não"}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {new Date(w.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
