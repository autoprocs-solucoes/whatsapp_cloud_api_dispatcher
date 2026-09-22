import { z } from "zod";

/**
 * Schema da campanha. Mora fora do arquivo de actions de propósito: um módulo
 * `"use server"` só pode exportar função assíncrona, então exportar o schema de
 * lá quebra a tela inteira no runtime — foi o que aconteceu ao criar campanha.
 */
export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à campanha").max(80),
  description: z.string().trim().max(280).default(""),
  /** O fluxo é o conteúdo da campanha: o primeiro bloco dele é o modelo que
   * abre, e o resto é a conversa depois da resposta. */
  flowId: z.string().uuid().nullable().default(null),
});

export const updateCampaignSchema = campaignSchema.extend({ id: z.string().uuid() });

export type CampaignInput = z.infer<typeof campaignSchema>;
