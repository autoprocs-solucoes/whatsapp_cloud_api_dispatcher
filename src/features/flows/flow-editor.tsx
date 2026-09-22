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
  ChevronLeft,
  Clock,
  Loader2,
  Maximize2,
  MessageSquare,
  Plus,
  Save,
  Trash2,
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
import { publishFlowAction, saveFlowGraphAction, unpublishFlowAction } from "@/features/flows/actions";
import { nodeTypes } from "@/features/flows/flow-nodes";
import {
  NEXT_HANDLE,
  type DelayNodeData,
  type FlowGraph,
  type FlowNodeData,
  type MessageNodeData,
} from "@/features/flows/schemas";
import { cn } from "@/lib/utils";

type EditorNode = Node<FlowNodeData>;

type Props = {
  flowId: string;
  flowName: string;
  status: "draft" | "published";
  graph: FlowGraph;
};

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
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
function Inspector({
  node,
  onChange,
  onClose,
  onDelete,
}: {
  node: EditorNode;
  onChange: (data: FlowNodeData) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const data = node.data;

  return (
    <aside className="absolute top-0 left-0 z-10 flex h-full w-[340px] flex-col border-r border-line bg-card shadow-lg">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">
          {data.kind === "message"
            ? "Enviar mensagem"
            : data.kind === "delay"
              ? "Atraso inteligente"
              : "Início"}
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar">
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {data.kind === "start" && (
          <p className="text-sm text-ink-2">
            É por aqui que o contato entra no fluxo. Ligue a saída dele no primeiro bloco.
          </p>
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
                <Input
                  value={data.media.url}
                  placeholder="https://..."
                  onChange={(e) =>
                    onChange({
                      ...data,
                      media: { ...data.media!, url: e.target.value },
                    })
                  }
                />
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
                      buttons: [...data.buttons, { id: newId("btn"), label: "" }],
                    })
                  }
                  disabled={data.buttons.length >= 10}
                >
                  <Plus className="size-3.5" /> Botão
                </Button>
              </div>
              {data.buttons.map((b, i) => (
                <div key={b.id} className="flex items-center gap-1.5">
                  <Input
                    value={b.label}
                    maxLength={25}
                    placeholder={`Botão ${i + 1}`}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        buttons: data.buttons.map((x) =>
                          x.id === b.id ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
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
              ))}
              {data.buttons.length > 3 && (
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

      {data.kind !== "start" && (
        <footer className="border-t border-line p-3">
          <Button variant="ghost" className="w-full text-destructive" onClick={onDelete}>
            <Trash2 className="size-4" /> Apagar bloco
          </Button>
        </footer>
      )}
    </aside>
  );
}

function Canvas({ flowId, flowName, status, graph }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>(
    graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      deletable: n.type !== "start",
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
