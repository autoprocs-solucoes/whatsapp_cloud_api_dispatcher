import Link from "next/link";
import type { Route } from "next";
import { MessageSquare, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageBubble } from "@/features/inbox/message-bubble";
import { ReplyForm } from "@/features/inbox/reply-form";
import { getThread, listConversations, markThreadRead } from "@/server/inbox";
import { requireActiveWorkspace } from "@/server/workspace";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{ tel?: string; q?: string }>;

const TYPE_PREVIEW: Record<string, string> = {
  image: "📷 Imagem",
  video: "🎥 Vídeo",
  audio: "🎧 Áudio",
  sticker: "🙂 Figurinha",
  document: "📄 Documento",
  location: "📍 Localização",
};

function preview(body: string | null, type: string): string {
  if (body) return body;
  return TYPE_PREVIEW[type] ?? "Mensagem";
}

function initials(name: string | null, phone: string): string {
  const source = name?.trim() || phone.replace(/\D/g, "").slice(-4);
  return source
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

/** Hoje mostra a hora; antes disso, a data. */
function shortTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default async function ConversasPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const workspace = await requireActiveWorkspace();

  const conversations = await listConversations(workspace.id, { search: sp.q, limit: 50 });
  const selectedPhone = sp.tel ?? conversations[0]?.contact_phone_e164 ?? null;

  const thread = selectedPhone ? await getThread(workspace.id, selectedPhone) : null;
  // Abrir a conversa zera o não lido — é o comportamento que todo mundo espera
  // de uma caixa de entrada.
  if (thread) await markThreadRead(workspace.id, thread.phone);

  const href = (tel: string): Route =>
    (sp.q ? `/conversas?q=${encodeURIComponent(sp.q)}&tel=${encodeURIComponent(tel)}` : `/conversas?tel=${encodeURIComponent(tel)}`) as Route;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conversas"
        description="Respostas dos seus contatos no WhatsApp, com os dois lados da conversa."
      />

      {conversations.length === 0 && !sp.q ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <MessageSquare className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">Nenhuma conversa ainda</h2>
              <p className="max-w-md text-sm text-ink-2">
                Assim que alguém responder um comunicado, a conversa aparece aqui. Mensagens
                enviadas pelo aplicativo do celular também entram, quando o número usa coexistência.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* Lista de conversas */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-card shadow-card">
            <form className="border-b border-line p-2.5" action="/conversas">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
                <Input
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="Buscar por nome ou número"
                  aria-label="Buscar conversa"
                  className="pl-8"
                />
              </div>
            </form>

            <div className="max-h-[32rem] overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="p-6 text-center text-sm text-ink-3">
                  Nenhuma conversa encontrada.
                </p>
              ) : (
                conversations.map((c) => {
                  const active = c.contact_phone_e164 === selectedPhone;
                  return (
                    <Link
                      key={c.contact_phone_e164}
                      href={href(c.contact_phone_e164)}
                      className={cn(
                        "flex items-start gap-2.5 border-b border-line px-3 py-2.5 transition-colors last:border-0",
                        active ? "bg-brand-soft" : "hover:bg-card-2",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-[11px] font-semibold text-ink-2">
                        {initials(c.contact_name, c.contact_phone_e164)}
                      </span>
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-ink">
                            {c.contact_name || c.contact_phone_e164}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-ink-3">
                            {shortTime(c.last_at)}
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-ink-2">
                            {c.last_direction === "out" && (
                              <span className="text-ink-3">Você: </span>
                            )}
                            {preview(c.last_body, c.last_type)}
                          </span>
                          {Number(c.unread) > 0 && (
                            <span className="num flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                              {c.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Conversa aberta */}
          <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-card">
            {!thread ? (
              <div className="flex flex-1 items-center justify-center text-sm text-ink-3">
                Escolha uma conversa à esquerda.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {thread.contactName || thread.phone}
                    </p>
                    <p className="truncate font-mono text-[11px] text-ink-3">{thread.phone}</p>
                  </div>
                  {thread.window.open === true && (
                    <StatusBadge tone="ok">
                      Janela aberta
                      {thread.window.hoursLeft !== null ? ` · ${thread.window.hoursLeft}h` : ""}
                    </StatusBadge>
                  )}
                  {thread.window.open === false && (
                    <StatusBadge tone="pending">Janela fechada</StatusBadge>
                  )}
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {thread.messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                </div>

                <ReplyForm phone={thread.phone} window={thread.window} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
