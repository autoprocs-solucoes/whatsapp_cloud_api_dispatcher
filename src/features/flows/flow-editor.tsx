"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  BellOff,
  ChevronLeft,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Maximize2,
  MessageSquare,
  Phone,
  Plus,
  Reply,
  Save,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import "@xyflow/react/dist/style.css";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  publishFlowAction,
  saveFlowGraphAction,
  unpublishFlowAction,
  uploadFlowMediaAction,
} from "@/features/flows/actions";
import { nodeTypes } from "@/features/flows/flow-nodes";
import {
  NEXT_HANDLE,
  replyButtonsOf,
  type DelayNodeData,
  type FlowButtonKind,
  type FlowGraph,
  type FlowNodeData,
  type MessageNodeData,
} from "@/features/flows/schemas";
import { cn } from "@/lib/utils";

type EditorNode = Node<FlowNodeData>;

export type TemplateOption = {
  id: string;
  name: string;
  language: string;
  bodyText: string | null;
};

type Props = {
  flowId: string;
  flowName: string;
  status: "draft" | "published";
  graph: FlowGraph;
  /** Modelos aprovados — só eles podem abrir um fluxo. */
  templates: TemplateOption[];
};

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const BUTTON_KIND_OPTIONS: FlowButtonKind[] = [
  "reply",
  "url",
  "phone",
  "copy_code",
  "opt_out",
];

const BUTTON_KIND_LABEL: Record<FlowButtonKind, string> = {
  reply: "Resposta rápida",
  url: "Link",
  phone: "Telefone",
  copy_code: "Copiar código",
  opt_out: "Cancelar inscrição",
};

function buttonKindIcon(kind: FlowButtonKind) {
  const className = "size-3.5";
  if (kind === "url") return <ExternalLink className={className} />;
  if (kind === "phone") return <Phone className={className} />;
  if (kind === "copy_code") return <Copy className={className} />;
  if (kind === "opt_out") return <BellOff className={className} />;
  return <Reply className={className} />;
}

function newButton(kind: FlowButtonKind) {
  return {
    id: newId("btn"),
    label: kind === "opt_out" ? "Parar promoções" : "",
    kind,
    url: "",
    phone: "",
    code: "",
  };
}

function emptyMessage(): MessageNodeData {
  return {
    kind: "message",
    title: "",
    body: "",
    footer: "",
    media: null,
    buttons: [],
    listTitle: "",
  };
}

function emptyDelay(): DelayNodeData {
  return { kind: "delay", mode: "duration", amount: 2, unit: "hours", at: "" };
}

// ----------------------------------------------------------------------------
// Painel de edição do bloco selecionado — o mesmo lugar do vídeo: abre à
// esquerda, por cima do canvas, e o canvas continua navegável ao lado.
// ----------------------------------------------------------------------------
const MEDIA_ACCEPT: Record<"image" | "video" | "document", string> = {
  image: "image/png,image/jpeg,image/webp",
  video: "video/mp4,video/3gpp",
  document: ".pdf,.doc,.docx,.xls,.xlsx",
};

function Inspector({
  node,
  templates,
  onChange,
  onClose,
  onDelete,
}: {
  node: EditorNode;
  templates: TemplateOption[];
  onChange: (data: FlowNodeData) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const data = node.data;
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  /** Sobe o arquivo e grava a URL pública no bloco. */
  function onUpload(kind: "image" | "video" | "document", file: File) {
    if (data.kind !== "message") return;
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    setUploading(true);
    void uploadFlowMediaAction(fd).then((result) => {
      setUploading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onChange({
        ...data,
        media: { type: kind, url: result.data.url, filename: result.data.filename },
      });
      toast.success("Arquivo enviado");
    });
  }

  return (
    <aside className="absolute top-0 left-0 z-10 flex h-full w-[340px] flex-col border-r border-line bg-card shadow-lg">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">
          {data.kind === "message"
            ? "Enviar mensagem"
            : data.kind === "delay"
              ? "Atraso inteligente"
              : data.kind === "template"
                ? "Modelo de abertura"
                : "Início"}
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar">
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {data.kind === "start" && (
          <p className="text-sm text-ink-2">
            É por aqui que o contato entra no fluxo. Ligue a saída dele no bloco do modelo.
          </p>
        )}

        {data.kind === "template" && (
          <>
            <p className="text-sm text-ink-2">
              É esta mensagem que a transmissão dispara. Fora da janela de 24h a Meta só entrega
              modelo aprovado — por isso a abertura é sempre um deles, e é a única cobrada.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="ins-template">Modelo aprovado</Label>
              <select
                id="ins-template"
                value={data.templateId ?? ""}
                onChange={(e) => {
                  const chosen = templates.find((t) => t.id === e.target.value);
                  onChange({
                    ...data,
                    templateId: chosen?.id ?? null,
                    templateName: chosen?.name ?? "",
                    templateLanguage: chosen?.language ?? "",
                  });
                }}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Selecione…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <p className="text-[11px] text-amber">
                  Nenhum modelo aprovado ainda. Crie em Templates e espere a revisão da Meta.
                </p>
              )}
            </div>

            {data.templateId && (
              <div className="space-y-1.5">
                <Label>Prévia</Label>
                <p className="rounded-md bg-card-2 p-2.5 text-[12px] whitespace-pre-wrap text-ink-2">
                  {templates.find((t) => t.id === data.templateId)?.bodyText ??
                    "Sem corpo sincronizado."}
                </p>
                <p className="text-[11px] text-ink-3">
                  As variáveis do modelo são preenchidas na transmissão, com os dados de cada
                  contato.
                </p>
              </div>
            )}
          </>
        )}

        {data.kind === "message" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ins-title">Título</Label>
              <Input
                id="ins-title"
                value={data.title}
                maxLength={60}
                placeholder="Opcional"
                onChange={(e) => onChange({ ...data, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ins-body">Corpo (obrigatório)</Label>
              <textarea
                id="ins-body"
                value={data.body}
                rows={6}
                maxLength={1024}
                placeholder="Texto"
                onChange={(e) => onChange({ ...data, body: e.target.value })}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
              <p className="text-right text-[11px] tabular-nums text-ink-3">
                {data.body.length}/1024
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ins-footer">Rodapé</Label>
              <Input
                id="ins-footer"
                value={data.footer}
                maxLength={60}
                placeholder="Opcional"
                onChange={(e) => onChange({ ...data, footer: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Mídia</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["image", "video", "document"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...data,
                        media:
                          data.media?.type === t ? null : { type: t, url: data.media?.url ?? "" },
                      })
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      data.media?.type === t
                        ? "border-brand bg-brand-soft text-brand-strong"
                        : "border-line-2 bg-card text-ink-2 hover:text-ink",
                    )}
                  >
                    {t === "image" ? "Imagem" : t === "video" ? "Vídeo" : "Arquivo"}
                  </button>
                ))}
              </div>

              {data.media && (
                <>
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept={MEDIA_ACCEPT[data.media.type]}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && data.media) onUpload(data.media.type, f);
                      e.target.value = "";
                    }}
                  />
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f && data.media) onUpload(data.media.type, f);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border border-dashed px-3 py-5 text-center transition-colors",
                      dragging ? "border-brand bg-brand-soft" : "border-line-2 bg-card",
                    )}
                  >
                    {data.media.url && data.media.type === "image" ? (
                      // Arquivo já no storage: mostra pra confirmar que subiu
                      // o certo. eslint-disable-next-line @next/next/no-img-element
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.media.url}
                        alt=""
                        className="max-h-24 rounded-md object-cover"
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => mediaInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Upload className="size-3.5" />
                      )}
                      {data.media.url ? "Trocar arquivo" : "Escolher arquivo"}
                    </Button>
                    <span className="text-[11px] text-ink-3">
                      {data.media.filename || (data.media.url ? "arquivo enviado" : "ou arraste até aqui")}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Botões</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...data,
                      buttons: [...data.buttons, newButton("reply")],
                    })
                  }
                  disabled={data.buttons.length >= 10}
                >
                  <Plus className="size-3.5" /> Botão
                </Button>
              </div>
              {data.buttons.map((b, i) => {
                const patch = (fields: Partial<typeof b>) =>
                  onChange({
                    ...data,
                    buttons: data.buttons.map((x) => (x.id === b.id ? { ...x, ...fields } : x)),
                  });
                return (
                  <div key={b.id} className="space-y-1.5 rounded-md border border-line p-2">
                    <div className="flex items-center gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            title={BUTTON_KIND_LABEL[b.kind]}
                            aria-label="Tipo do botão"
                          >
                            {buttonKindIcon(b.kind)}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          {BUTTON_KIND_OPTIONS.map((k) => (
                            <DropdownMenuItem
                              key={k}
                              onClick={() =>
                                patch({
                                  kind: k,
                                  label:
                                    k === "opt_out" && !b.label ? "Parar promoções" : b.label,
                                })
                              }
                            >
                              {buttonKindIcon(k)} {BUTTON_KIND_LABEL[k]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Input
                        value={b.label}
                        maxLength={25}
                        placeholder={`Botão ${i + 1}`}
                        onChange={(e) => patch({ label: e.target.value })}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remover botão"
                        onClick={() =>
                          onChange({
                            ...data,
                            buttons: data.buttons.filter((x) => x.id !== b.id),
                          })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {b.kind === "url" && (
                      <Input
                        value={b.url}
                        placeholder="https://..."
                        onChange={(e) => patch({ url: e.target.value })}
                      />
                    )}
                    {b.kind === "phone" && (
                      <>
                        <Input
                          value={b.phone}
                          placeholder="+5511999999999"
                          onChange={(e) => patch({ phone: e.target.value })}
                        />
                        <p className="text-[11px] text-ink-3">
                          Dentro da janela de 24h a Meta não entrega botão de ligar: o número sai
                          numa linha da mensagem, tocável no WhatsApp.
                        </p>
                      </>
                    )}
                    {b.kind === "copy_code" && (
                      <>
                        <Input
                          value={b.code}
                          maxLength={15}
                          placeholder="PROMO10"
                          onChange={(e) => patch({ code: e.target.value })}
                        />
                        <p className="text-[11px] text-ink-3">
                          Botão de copiar só existe em modelo aprovado: aqui o código sai numa
                          linha da mensagem, pra pessoa copiar segurando.
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
              {data.buttons.some((b) => b.kind === "url") && data.buttons.length > 1 && (
                <p className="text-[11px] text-amber">
                  O WhatsApp entrega botão de link sozinho: com um link na mensagem, os outros
                  botões não aparecem.
                </p>
              )}
              {replyButtonsOf(data.buttons).length > 3 && (
                <div className="space-y-1.5">
                  <Label htmlFor="ins-list">Título da lista</Label>
                  <Input
                    id="ins-list"
                    value={data.listTitle}
                    maxLength={24}
                    placeholder="Ver opções"
                    onChange={(e) => onChange({ ...data, listTitle: e.target.value })}
                  />
                  <p className="text-[11px] text-ink-3">
                    Acima de 3 botões o WhatsApp entrega como lista.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {data.kind === "delay" && (
          <>
            <div className="flex items-center rounded-md border border-line-2 bg-card p-0.5">
              {(["duration", "datetime"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange({ ...data, mode: m })}
                  className={cn(
                    "flex-1 rounded-sm px-3 py-1 text-[13px] font-medium transition-colors",
                    data.mode === m
                      ? "bg-brand-soft text-brand-strong"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  {m === "duration" ? "Atraso" : "Data & Hora"}
                </button>
              ))}
            </div>

            {data.mode === "duration" ? (
              <div className="flex items-end gap-2">
                <div className="w-24 space-y-1.5">
                  <Label htmlFor="ins-amount">Esperar</Label>
                  <Input
                    id="ins-amount"
                    type="number"
                    min={1}
                    max={999}
                    value={data.amount}
                    onChange={(e) =>
                      onChange({ ...data, amount: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </div>
                <select
                  value={data.unit}
                  onChange={(e) =>
                    onChange({ ...data, unit: e.target.value as DelayNodeData["unit"] })
                  }
                  className="border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm"
                >
                  <option value="minutes">minutos</option>
                  <option value="hours">horas</option>
                  <option value="days">dias</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="ins-at">Data e hora</Label>
                <Input
                  id="ins-at"
                  type="datetime-local"
                  value={data.at}
                  onChange={(e) => onChange({ ...data, at: e.target.value })}
                />
                <p className="text-[11px] text-ink-3">
                  Segue o fuso do workspace. Contato que chegar depois da data pula este bloco.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {data.kind !== "start" && data.kind !== "template" && (
        <footer className="border-t border-line p-3">
          <Button variant="ghost" className="w-full text-destructive" onClick={onDelete}>
            <Trash2 className="size-4" /> Apagar bloco
          </Button>
        </footer>
      )}
    </aside>
  );
}

function Canvas({ flowId, flowName, status, graph, templates }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>(
    graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      // Início e modelo de abertura são a espinha do fluxo: não se apagam.
      deletable: n.type !== "start" && n.type !== "template",
    })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isSaving, startSave] = useTransition();
  const [isPublishing, startPublish] = useTransition();
  const { zoomIn, zoomOut, fitView, screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  /** Uma saída só pode ir pra um bloco — religar substitui a ligação antiga em
   * vez de empilhar duas setas saindo do mesmo botão. */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const cleaned = eds.filter(
          (e) =>
            !(
              e.source === connection.source &&
              (e.sourceHandle ?? NEXT_HANDLE) === (connection.sourceHandle ?? NEXT_HANDLE)
            ),
        );
        return addEdge({ ...connection, id: newId("edge") }, cleaned);
      });
      setDirty(true);
    },
    [setEdges],
  );

  function addNode(kind: "message" | "delay") {
    const wrapper = wrapperRef.current;
    const rect = wrapper?.getBoundingClientRect();
    const position = screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 600) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 400) / 3,
    });

    const node: EditorNode = {
      id: newId(kind),
      type: kind,
      position,
      data: kind === "message" ? emptyMessage() : emptyDelay(),
      deletable: true,
    };
    setNodes((ns) => [...ns, node]);
    setSelectedId(node.id);
    setDirty(true);
  }

  function updateSelected(data: FlowNodeData) {
    setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data } : n)));
    setDirty(true);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
    setDirty(true);
  }

  const currentGraph = useCallback(
    (): FlowGraph => ({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.type ?? "message") as "start" | "message" | "delay",
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })),
    }),
    [nodes, edges],
  );

  function handleSave() {
    startSave(async () => {
      const result = await saveFlowGraphAction({ flowId, graph: currentGraph() });
      if (result.ok) {
        setDirty(false);
        toast.success("Fluxo salvo");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handlePublish() {
    startPublish(async () => {
      // Publicar sem salvar publicaria o desenho antigo.
      const saved = await saveFlowGraphAction({ flowId, graph: currentGraph() });
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      setDirty(false);

      const result =
        currentStatus === "published"
          ? await unpublishFlowAction(flowId)
          : await publishFlowAction(flowId);
      if (result.ok) {
        setCurrentStatus(currentStatus === "published" ? "draft" : "published");
        toast.success(currentStatus === "published" ? "Fluxo despublicado" : "Fluxo publicado");
      } else {
        toast.error(result.error);
      }
    });
  }

  // Ctrl/Cmd+S salva, como em qualquer editor.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col overflow-hidden rounded-lg border border-line bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/fluxos">
              <ChevronLeft className="size-4" /> Fluxos
            </Link>
          </Button>
          <span className="truncate text-sm font-semibold text-ink">{flowName}</span>
          <StatusBadge tone={currentStatus === "published" ? "ok" : "pending"}>
            {currentStatus === "published" ? "Publicado" : "Rascunho"}
          </StatusBadge>
          {dirty && <span className="text-[11px] text-ink-3">alterações não salvas</span>}
        </div>

        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="size-3.5" /> Bloco
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => addNode("message")}>
                <MessageSquare className="size-3.5" /> Enviar mensagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNode("delay")}>
                <Clock className="size-3.5" /> Atraso inteligente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving || !dirty}>
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing && <Loader2 className="size-3.5 animate-spin" />}
            {currentStatus === "published" ? "Despublicar" : "Publicar"}
          </Button>
        </div>
      </header>

      <div ref={wrapperRef} className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) => {
            onNodesChange(changes);
            if (changes.some((c) => c.type !== "select" && c.type !== "dimensions")) {
              setDirty(true);
            }
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes);
            if (changes.some((c) => c.type !== "select")) setDirty(true);
          }}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ style: { strokeWidth: 2 }, animated: false }}
          className="bg-card-2"
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} />
        </ReactFlow>

        {/* Controles próprios: os do react-flow não seguem o tema do app. */}
        <div className="absolute right-3 bottom-3 flex flex-col gap-1 rounded-md border border-line bg-card p-1 shadow-card">
          <Button variant="ghost" size="icon-sm" onClick={() => zoomIn()} aria-label="Aproximar">
            <ZoomIn className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => zoomOut()} aria-label="Afastar">
            <ZoomOut className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fitView({ duration: 200 })}
            aria-label="Enquadrar"
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>

        {selected && (
          <Inspector
            node={selected}
            templates={templates}
            onChange={updateSelected}
            onClose={() => setSelectedId(null)}
            onDelete={deleteSelected}
          />
        )}
      </div>
    </div>
  );
}

export function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
