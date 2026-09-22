import { NEXT_HANDLE, type FlowGraph } from "@/features/flows/schemas";

/**
 * Fluxos padrões básicos — os mesmos atalhos que o BotConversa oferece na
 * tela de fluxos. Cria um fluxo já desenhado pra pessoa só ajustar o texto.
 */

export const FLOW_PRESETS = [
  { key: "welcome", label: "Fluxo de boas-vindas" },
  { key: "default_reply", label: "Fluxo de resposta padrão" },
  { key: "media", label: "Fluxo padrão para mídia" },
  { key: "post_service", label: "Fluxo pós-atendimento" },
] as const;

export type FlowPresetKey = (typeof FLOW_PRESETS)[number]["key"];

export function isPresetKey(value: string): value is FlowPresetKey {
  return FLOW_PRESETS.some((p) => p.key === value);
}

/** Todo padrão começa igual: entrada + bloco do modelo (ainda sem escolher).
 * O modelo é o que sai na transmissão; o resto do desenho é a conversa depois
 * da resposta. */
function opening(): { nodes: FlowGraph["nodes"]; edges: FlowGraph["edges"] } {
  return {
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: -180, y: 0 },
        data: { kind: "start", label: "Início" },
      },
      {
        id: "opening",
        type: "template",
        position: { x: 60, y: -30 },
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
}

export function presetGraph(key: FlowPresetKey): FlowGraph {
  switch (key) {
    case "welcome":
      return {
        nodes: [
          ...opening().nodes,
          {
            id: "msg_welcome",
            type: "message",
            position: { x: 320, y: -40 },
            data: {
              kind: "message",
              title: "",
              body: "Olá! 👋 Que bom ter você por aqui.\n\nComo podemos ajudar hoje?",
              footer: "",
              media: null,
              buttons: [
                { id: "btn_help", label: "Falar com alguém", kind: "reply" as const, url: "", phone: "", code: "" },
                { id: "btn_info", label: "Ver informações", kind: "reply" as const, url: "", phone: "", code: "" },
              ],
              listTitle: "",
            },
          },
          {
            id: "msg_help",
            type: "message",
            position: { x: 680, y: -140 },
            data: {
              kind: "message",
              title: "",
              body: "Perfeito! Já chamei alguém do time. É só aguardar aqui mesmo.",
              footer: "",
              media: null,
              buttons: [],
              listTitle: "",
            },
          },
          {
            id: "msg_info",
            type: "message",
            position: { x: 680, y: 120 },
            data: {
              kind: "message",
              title: "",
              body: "Claro! Me conta o que você quer saber que eu te explico.",
              footer: "",
              media: null,
              buttons: [],
              listTitle: "",
            },
          },
        ],
        edges: [
          ...opening().edges,
          { id: "e1", source: "opening", target: "msg_welcome", sourceHandle: "next", targetHandle: null },
          {
            id: "e2",
            source: "msg_welcome",
            target: "msg_help",
            sourceHandle: "btn_help",
            targetHandle: null,
          },
          {
            id: "e3",
            source: "msg_welcome",
            target: "msg_info",
            sourceHandle: "btn_info",
            targetHandle: null,
          },
        ],
      };

    case "default_reply":
      return {
        nodes: [
          ...opening().nodes,
          {
            id: "msg_default",
            type: "message",
            position: { x: 320, y: 0 },
            data: {
              kind: "message",
              title: "",
              body: "Recebemos sua mensagem! Nosso time responde no horário comercial, de segunda a sexta, das 9h às 18h.",
              footer: "",
              media: null,
              buttons: [],
              listTitle: "",
            },
          },
        ],
        edges: [
          ...opening().edges,
          { id: "e1", source: "opening", target: "msg_default", sourceHandle: "next", targetHandle: null },
        ],
      };

    case "media":
      return {
        nodes: [
          ...opening().nodes,
          {
            id: "msg_media",
            type: "message",
            position: { x: 320, y: 0 },
            data: {
              kind: "message",
              title: "",
              body: "Segue o material que combinamos 👇",
              footer: "",
              media: { type: "document", url: "" },
              buttons: [],
              listTitle: "",
            },
          },
        ],
        edges: [
          ...opening().edges,
          { id: "e1", source: "opening", target: "msg_media", sourceHandle: "next", targetHandle: null },
        ],
      };

    case "post_service":
      return {
        nodes: [
          ...opening().nodes,
          {
            id: "delay_wait",
            type: "delay",
            position: { x: 300, y: 10 },
            data: { kind: "delay", mode: "duration", amount: 2, unit: "hours", at: "" },
          },
          {
            id: "msg_survey",
            type: "message",
            position: { x: 600, y: -20 },
            data: {
              kind: "message",
              title: "",
              body: "Conseguimos te ajudar hoje?",
              footer: "Sua resposta ajuda a melhorar o atendimento",
              media: null,
              buttons: [
                { id: "btn_yes", label: "Sim, obrigado!", kind: "reply" as const, url: "", phone: "", code: "" },
                { id: "btn_no", label: "Ainda preciso de ajuda", kind: "reply" as const, url: "", phone: "", code: "" },
              ],
              listTitle: "",
            },
          },
          {
            id: "msg_thanks",
            type: "message",
            position: { x: 960, y: -120 },
            data: {
              kind: "message",
              title: "",
              body: "Que bom! Qualquer coisa é só chamar por aqui. 🙌",
              footer: "",
              media: null,
              buttons: [],
              listTitle: "",
            },
          },
          {
            id: "msg_back",
            type: "message",
            position: { x: 960, y: 140 },
            data: {
              kind: "message",
              title: "",
              body: "Sem problema! Já avisei o time pra retomar seu atendimento.",
              footer: "",
              media: null,
              buttons: [],
              listTitle: "",
            },
          },
        ],
        edges: [
          ...opening().edges,
          { id: "e1", source: "opening", target: "delay_wait", sourceHandle: "next", targetHandle: null },
          {
            id: "e2",
            source: "delay_wait",
            target: "msg_survey",
            sourceHandle: "next",
            targetHandle: null,
          },
          {
            id: "e3",
            source: "msg_survey",
            target: "msg_thanks",
            sourceHandle: "btn_yes",
            targetHandle: null,
          },
          {
            id: "e4",
            source: "msg_survey",
            target: "msg_back",
            sourceHandle: "btn_no",
            targetHandle: null,
          },
        ],
      };
  }
}
