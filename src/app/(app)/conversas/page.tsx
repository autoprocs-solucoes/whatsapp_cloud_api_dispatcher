import Link from "next/link";
import type { Route } from "next";
import { Search, X } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { WhatsAppMark } from "@/components/whatsapp-mark";
import { Card, CardContent } from "@/components/ui/card";
import { MessageBubble } from "@/features/inbox/message-bubble";
import { ReplyForm } from "@/features/inbox/reply-form";
import { getThread, listConversations, markThreadRead } from "@/server/inbox";
import { requireActiveWorkspace } from "@/server/workspace";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{ tel?: string; q?: string; fechado?: string }>;

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

/** Hoje mostra a hora; antes disso, a data — como o WhatsApp. */
function shortTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Separador de dia entre as bolhas, como no app. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "HOJE";
  if (d.toDateString() === yesterday.toDateString()) return "ONTEM";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function ConversasPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const workspace = await requireActiveWorkspace();

  const conversations = await listConversations(workspace.id, { search: sp.q, limit: 50 });

  // Sem `tel` a primeira conversa abre sozinha, que é o esperado ao entrar na
  // tela. `fechado=1` é o que o botão de fechar usa pra dizer "nenhuma", já
  // que ausência de `tel` significa "abre a primeira".
  const closed = sp.fechado === "1";
  const selectedPhone = closed ? null : (sp.tel ?? conversations[0]?.contact_phone_e164 ?? null);

  const thread = selectedPhone ? await getThread(workspace.id, selectedPhone) : null;
  // Abrir a conversa zera o não lido — é o comportamento que todo mundo espera
  // de uma caixa de entrada.
  if (thread) await markThreadRead(workspace.id, thread.phone);

  const qs = sp.q ? `q=${encodeURIComponent(sp.q)}&` : "";
  const href = (tel: string): Route => `/conversas?${qs}tel=${encodeURIComponent(tel)}` as Route;
  const closeHref = `/conversas?${qs}fechado=1` as Route;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        {/* Sem círculo por trás: a própria logo já é o balão verde. */}
        <WhatsAppMark size={34} filled />
        <div>
          <h1 className="text-[23px] leading-tight font-semibold tracking-tight text-ink">
            Conversas
          </h1>
          <p className="text-sm text-ink-2">
            Respostas dos seus contatos no WhatsApp, com os dois lados da conversa.
          </p>
        </div>
      </div>

      {conversations.length === 0 && !sp.q ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <WhatsAppMark size={48} filled />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">Nenhuma conversa ainda</h2>
              <p className="max-w-md text-sm text-ink-2">
                Assim que alguém responder uma transmissão, a conversa aparece aqui. Mensagens
                enviadas pelo aplicativo do celular também entram, quando o número usa coexistência.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid h-[calc(100vh-13rem)] min-h-[32rem] overflow-hidden rounded-lg border border-wa-line shadow-card lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          {/* Lista de conversas */}
          <div className="flex flex-col border-r border-wa-line bg-wa-in">
            <form className="bg-wa-panel p-2" action="/conversas">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-wa-ink-2" />
                <input
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="Pesquisar"
                  aria-label="Buscar conversa"
                  className="h-9 w-full rounded-lg border-0 bg-wa-in pl-9 text-[14px] text-wa-ink outline-none placeholder:text-wa-ink-2 focus-visible:ring-2 focus-visible:ring-wa-accent"
                />
              </div>
            </form>

            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="p-6 text-center text-sm text-wa-ink-2">
                  Nenhuma conversa encontrada.
                </p>
              ) : (
                conversations.map((c) => {
                  const active = c.contact_phone_e164 === selectedPhone;
                  const unread = Number(c.unread);
                  return (
                    <Link
                      key={c.contact_phone_e164}
                      href={href(c.contact_phone_e164)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 transition-colors",
                        active ? "bg-wa-active" : "hover:bg-wa-hover",
                      )}
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-wa-panel text-[13px] font-semibold text-wa-ink-2">
                        {initials(c.contact_name, c.contact_phone_e164)}
                      </span>
                      <span className="min-w-0 flex-1 border-b border-wa-line pb-2.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[16px] text-wa-ink">
                            {c.contact_name || c.contact_phone_e164}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-[12px]",
                              unread > 0 ? "text-wa-accent" : "text-wa-ink-2",
                            )}
                          >
                            {shortTime(c.last_at)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] text-wa-ink-2">
                            {c.last_direction === "out" && <span>Você: </span>}
                            {preview(c.last_body, c.last_type)}
                          </span>
                          {unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-wa-accent px-1.5 text-[12px] font-medium text-white">
                              {unread}
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
          <div className="flex min-h-0 flex-col bg-wa-bg">
            {!thread ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-wa-panel text-wa-ink-2">
                  <WhatsAppMark size={34} />
                </span>
                <p className="text-sm text-wa-ink-2">Escolha uma conversa à esquerda.</p>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-wa-panel px-4 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-in text-[12px] font-semibold text-wa-ink-2">
                      {initials(thread.contactName, thread.phone)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[16px] text-wa-ink">
                        {thread.contactName || thread.phone}
                      </p>
                      <p className="truncate text-[12px] text-wa-ink-2">{thread.phone}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {thread.window.open === true && (
                      <StatusBadge tone="ok">
                        Janela aberta
                        {thread.window.hoursLeft !== null ? ` · ${thread.window.hoursLeft}h` : ""}
                      </StatusBadge>
                    )}
                    {thread.window.open === false && (
                      <StatusBadge tone="pending">Janela fechada</StatusBadge>
                    )}
                    {/* Fecha só a visualização — a conversa e o histórico
                        continuam intactos, e ela segue na lista à esquerda. */}
                    <Link
                      href={closeHref}
                      aria-label="Fechar conversa"
                      title="Fechar conversa"
                      className="flex size-8 items-center justify-center rounded-full text-wa-ink-2 transition-colors hover:bg-wa-active hover:text-wa-ink"
                    >
                      <X className="size-4.5" />
                    </Link>
                  </div>
                </div>

                <div className="flex-1 space-y-1.5 overflow-y-auto px-6 py-4">
                  {thread.messages.map((m, i) => {
                    const prev = thread.messages[i - 1];
                    const newDay =
                      !prev ||
                      new Date(prev.sent_at).toDateString() !==
                        new Date(m.sent_at).toDateString();
                    return (
                      <div key={m.id} className="space-y-1.5">
                        {newDay && (
                          <div className="flex justify-center py-2">
                            <span className="rounded-lg bg-wa-panel px-3 py-1 text-[12px] font-medium text-wa-ink-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                              {dayLabel(m.sent_at)}
                            </span>
                          </div>
                        )}
                        <MessageBubble message={m} />
                      </div>
                    );
                  })}
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
