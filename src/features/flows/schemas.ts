import { z } from "zod";

/**
 * Desenho do fluxo. O canvas salva o grafo inteiro de uma vez, então o schema
 * descreve o `graph` jsonb da tabela `flow`.
 *
 * O primeiro bloco é sempre um template aprovado: é ele que sai na transmissão,
 * fora da janela de 24h, e é o único cobrado pela Meta. Da resposta em diante a
 * janela está aberta e os blocos seguintes são mensagem livre.
 *
 * Ramificação: cada botão do nó de mensagem vira uma saída própria
 * (`sourceHandle` = id do botão). Nó sem botão tem a saída única "next".
 */

export const NEXT_HANDLE = "next";

/**
 * Botão do bloco de mensagem.
 *
 * `reply` é resposta rápida: o contato toca, o WhatsApp devolve o texto e o
 * fluxo segue pela saída daquele botão. `url` é o botão de link (cta_url da
 * Cloud API): leva pra fora da conversa, não gera resposta e, por regra da
 * Meta, só pode existir sozinho na mensagem.
 */
export type FlowButton = {
  id: string;
  label: string;
  kind: "reply" | "url";
  url: string;
};

export const buttonSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Escreva o texto do botão").max(25),
  kind: z.enum(["reply", "url"]).default("reply"),
  url: z.string().trim().max(2000).default(""),
});

/** Bloco que tem botão de link — ele manda pra fora e não pode dividir a
 * mensagem com resposta rápida. */
export function linkButtonOf(buttons: FlowButton[]): FlowButton | null {
  return buttons.find((b) => b.kind === "url") ?? null;
}

export const mediaSchema = z.object({
  type: z.enum(["image", "video", "document"]),
  url: z.string().trim().url("URL inválida"),
  filename: z.string().trim().max(120).optional(),
});

export const messageNodeDataSchema = z.object({
  kind: z.literal("message"),
  title: z.string().trim().max(60).default(""),
  body: z.string().trim().max(1024).default(""),
  footer: z.string().trim().max(60).default(""),
  media: mediaSchema.nullable().default(null),
  /** Botões de resposta rápida. Acima de 3 o WhatsApp entrega como lista. */
  buttons: z.array(buttonSchema).max(10).default([]),
  /** Título da lista, usado quando há mais de 3 botões. */
  listTitle: z.string().trim().max(24).default(""),
});

/** Primeiro bloco: o template aprovado que abre a conversa. O conteúdo vive na
 * Meta, aqui guarda-se só a referência — assim o fluxo acompanha edição e
 * status do modelo sem cópia desatualizada. */
export const templateNodeDataSchema = z.object({
  kind: z.literal("template"),
  templateId: z.string().uuid().nullable().default(null),
  /** Nome e idioma guardados só pro canvas não precisar consultar o banco. */
  templateName: z.string().trim().max(512).default(""),
  templateLanguage: z.string().trim().max(10).default(""),
});

export const delayNodeDataSchema = z
  .object({
    kind: z.literal("delay"),
    /** duration: espera um tempo. datetime: espera até uma data e hora. */
    mode: z.enum(["duration", "datetime"]).default("duration"),
    amount: z.number().int().min(1).max(999).default(2),
    unit: z.enum(["minutes", "hours", "days"]).default("hours"),
    /** ISO local (yyyy-MM-ddTHH:mm) quando o modo é datetime. */
    at: z.string().trim().default(""),
  })
  .refine((d) => d.mode !== "datetime" || d.at.length > 0, {
    message: "Escolha a data e a hora",
    path: ["at"],
  });

export const startNodeDataSchema = z.object({
  kind: z.literal("start"),
  label: z.string().trim().max(60).default("Início"),
});

export const flowNodeDataSchema = z.discriminatedUnion("kind", [
  startNodeDataSchema,
  templateNodeDataSchema,
  messageNodeDataSchema,
  delayNodeDataSchema,
]);

export type FlowNodeData = z.infer<typeof flowNodeDataSchema>;
export type TemplateNodeData = z.infer<typeof templateNodeDataSchema>;
export type MessageNodeData = z.infer<typeof messageNodeDataSchema>;
export type DelayNodeData = z.infer<typeof delayNodeDataSchema>;
export type StartNodeData = z.infer<typeof startNodeDataSchema>;

export const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["start", "template", "message", "delay"]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: flowNodeDataSchema,
});

export const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().default(null),
  targetHandle: z.string().nullable().default(null),
});

export const flowGraphSchema = z.object({
  nodes: z.array(flowNodeSchema).max(300),
  edges: z.array(flowEdgeSchema).max(600),
});

export type FlowGraph = z.infer<typeof flowGraphSchema>;
export type FlowNode = z.infer<typeof flowNodeSchema>;
export type FlowEdge = z.infer<typeof flowEdgeSchema>;

export const EMPTY_GRAPH: FlowGraph = {
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 0, y: 0 },
      data: { kind: "start", label: "Início" },
    },
    // Fluxo já nasce com o bloco do template: sem ele não há o que transmitir.
    {
      id: "opening",
      type: "template",
      position: { x: 280, y: -30 },
      data: { kind: "template", templateId: null, templateName: "", templateLanguage: "" },
    },
  ],
  edges: [
    {
      id: "edge_start",
      source: "start",
      target: "opening",
      sourceHandle: NEXT_HANDLE,
      targetHandle: null,
    },
  ],
};

/** O bloco de template do fluxo — o que a transmissão dispara. */
export function openingTemplateNode(graph: FlowGraph): FlowNode | null {
  return graph.nodes.find((n) => n.data.kind === "template") ?? null;
}

/** Id do template que abre o fluxo, se já escolhido. */
export function openingTemplateId(graph: FlowGraph): string | null {
  const node = openingTemplateNode(graph);
  return node && node.data.kind === "template" ? node.data.templateId : null;
}

/** Lê o `graph` jsonb com tolerância: fluxo salvo por versão antiga do editor
 * não pode quebrar a tela — cai no grafo vazio. */
export function parseGraph(raw: unknown): FlowGraph {
  const parsed = flowGraphSchema.safeParse(raw);
  if (!parsed.success) return EMPTY_GRAPH;
  if (parsed.data.nodes.length === 0) return EMPTY_GRAPH;
  return parsed.data;
}

export const saveFlowGraphSchema = z.object({
  flowId: z.string().uuid(),
  graph: flowGraphSchema,
});

export const createFlowSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao fluxo").max(80),
  folderId: z.string().uuid().nullable().default(null),
});

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à pasta").max(80),
});

export const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
});

export const moveFlowSchema = z.object({
  flowId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
});
