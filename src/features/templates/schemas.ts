import { z } from "zod";

/**
 * Criação de modelo de mensagem (template) na Meta. Os limites aqui são os da
 * própria Meta — vale validar no cliente pra não gastar uma revisão de 24h com
 * erro bobo.
 */

export const TEMPLATE_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

export const CATEGORY_DESCRIPTION: Record<TemplateCategory, string> = {
  MARKETING: "Promove a marca com ofertas e campanhas. Ideal pra reengajamento e conversão.",
  UTILITY:
    "Mantém o cliente informado: lembretes, confirmações e avisos não promocionais.",
  AUTHENTICATION: "Códigos de verificação e login em duas etapas.",
};

export const HEADER_TYPES = ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"] as const;

export type TemplateHeaderType = (typeof HEADER_TYPES)[number];

/**
 * Tipos de botão que a Meta aceita num template. O botão de link pode carregar
 * uma variável no fim da URL (`https://site.com/{{1}}`) — nesse caso ela exige
 * um exemplo de URL completa pra revisão.
 */
export const templateButtonSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("QUICK_REPLY"),
    text: z.string().trim().min(1, "Nome do botão obrigatório").max(25),
  }),
  z.object({
    type: z.literal("URL"),
    text: z.string().trim().min(1, "Nome do botão obrigatório").max(25),
    url: z
      .string()
      .trim()
      .min(1, "Informe a URL")
      .max(2000)
      .refine((v) => /^https?:\/\//i.test(v), "A URL precisa começar com http:// ou https://"),
    /** Exemplo da URL montada, exigido quando ela tem variável. */
    urlExample: z.string().trim().max(2000).default(""),
  }),
  z.object({
    type: z.literal("PHONE_NUMBER"),
    text: z.string().trim().min(1, "Nome do botão obrigatório").max(25),
    phone_number: z.string().trim().min(5, "Telefone inválido").max(20),
  }),
  z.object({
    type: z.literal("COPY_CODE"),
    text: z.string().trim().max(25).default("Copiar código"),
    /** O código que o botão copia. A Meta chama de exemplo, mas é ele que vai
     * junto em todo envio. */
    example: z.string().trim().min(1, "Informe o código").max(15),
  }),
]);

export type TemplateButtonInput = z.infer<typeof templateButtonSchema>;

export const createTemplateSchema = z
  .object({
    connectionId: z.string().uuid(),
    // A Meta só aceita minúsculas, números e underscore no nome.
    name: z
      .string()
      .trim()
      .min(1, "Informe um nome")
      .max(512)
      .regex(/^[a-z0-9_]+$/, "Use só letras minúsculas, números e underscore"),
    language: z.string().trim().min(2).max(10),
    category: z.enum(TEMPLATE_CATEGORIES),
    headerType: z.enum(HEADER_TYPES).default("NONE"),
    headerText: z.string().trim().max(60).default(""),
    /** Handle devolvido pelo upload — preenchido quando o cabeçalho é mídia. */
    headerHandle: z.string().trim().default(""),
    bodyText: z.string().trim().min(1, "O corpo é obrigatório").max(1024),
    footerText: z.string().trim().max(60).default(""),
    buttons: z.array(templateButtonSchema).max(10, "No máximo 10 botões").default([]),
    /** Exemplo por variável, com chave "header:<var>" / "body:<var>". */
    examples: z.record(z.string(), z.string().trim().max(500)).default({}),
  })
  .refine(
    (d) =>
      d.buttons.every(
        (b) => b.type !== "URL" || !b.url.includes("{{") || b.urlExample.length > 0,
      ),
    { message: "Botão de link com variável precisa de um exemplo de URL", path: ["buttons"] },
  )
  .refine((d) => d.headerType !== "TEXT" || d.headerText.length > 0, {
    message: "Escreva o título do cabeçalho",
    path: ["headerText"],
  })
  .refine(
    (d) => !["IMAGE", "VIDEO", "DOCUMENT"].includes(d.headerType) || d.headerHandle.length > 0,
    { message: "Envie o arquivo do cabeçalho", path: ["headerHandle"] },
  );

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
