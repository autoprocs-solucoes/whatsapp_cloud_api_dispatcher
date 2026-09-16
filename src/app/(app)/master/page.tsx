import Image from "next/image";

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

const CONNECTION_METHOD_LABEL: Record<string, string> = {
  coexistence: "Coexistência",
  embedded_signup: "Embedded Signup",
  manual: "Manual",
};

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
          Visão cross-tenant de todos os clientes (workspaces) da plataforma. Só visível pra
          usuários com <code className="text-[11px]">is_superadmin</code>.
        </p>
      </header>

      <div className="text-muted-foreground text-sm">
        {workspaces.length} workspace(s) no total.
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Cliente</th>
              <th className="px-3 py-2 text-left font-medium">Owner</th>
              <th className="px-3 py-2 text-right font-medium">Membros</th>
              <th className="px-3 py-2 text-right font-medium">Contatos</th>
              <th className="px-3 py-2 text-right font-medium">Comunicados (30d)</th>
              <th className="px-3 py-2 text-left font-medium">Conexão Meta</th>
              <th className="px-3 py-2 text-left font-medium">Criado em</th>
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
              workspaces.map((w) => (
                <tr key={w.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium">{w.name}</p>
                    <p className="text-muted-foreground text-[10px]">{w.slug}</p>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {w.ownerEmail ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{w.memberCount}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{w.contactCount}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{w.dispatchCount30d}</td>
                  <td className="px-3 py-2">
                    {w.connections.length === 0 ? (
                      <span className="text-muted-foreground text-xs">Sem conexão</span>
                    ) : (
                      <div className="space-y-1">
                        {w.connections.map((c) => (
                          <div key={c.id} className="flex items-center gap-1.5">
                            <Badge variant={healthBadgeVariant(c.canSendMessage)} className="text-[10px]">
                              {c.canSendMessage ?? "—"}
                            </Badge>
                            <span className="text-xs">{c.businessName ?? c.wabaId}</span>
                            <span className="text-muted-foreground text-[10px]">
                              ({CONNECTION_METHOD_LABEL[c.connectionMethod] ?? c.connectionMethod})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {new Date(w.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
