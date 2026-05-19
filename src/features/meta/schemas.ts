import { z } from "zod";

export const completeMetaSignupSchema = z.object({
  workspaceId: z.string().uuid(),
  code: z.string().min(10),
  wabaId: z.string().min(1),
  phoneNumberIds: z.array(z.string()).optional(),
});

export type CompleteMetaSignupInput = z.infer<typeof completeMetaSignupSchema>;

export const connectMetaManuallySchema = z.object({
  workspaceId: z.string().uuid(),
  wabaId: z
    .string()
    .trim()
    .min(5, "WABA ID inválido")
    .regex(/^\d+$/, "WABA ID precisa ser numérico"),
  accessToken: z
    .string()
    .trim()
    .min(40, "Access token muito curto — confira no Business Manager"),
});

export type ConnectMetaManuallyInput = z.infer<typeof connectMetaManuallySchema>;

export const disconnectMetaSchema = z.object({
  workspaceId: z.string().uuid(),
});

export type DisconnectMetaInput = z.infer<typeof disconnectMetaSchema>;

export const syncMetaConnectionSchema = z.object({
  workspaceId: z.string().uuid(),
});

export type SyncMetaConnectionInput = z.infer<typeof syncMetaConnectionSchema>;
