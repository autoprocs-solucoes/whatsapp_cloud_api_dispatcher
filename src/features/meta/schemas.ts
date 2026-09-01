import { z } from "zod";

export const completeMetaSignupSchema = z.object({
  workspaceId: z.string().uuid(),
  code: z.string().min(10),
  wabaId: z.string().min(1),
  phoneNumberIds: z.array(z.string()).optional(),
  connectionMethod: z.enum(["embedded_signup", "coexistence"]).default("embedded_signup"),
});

export type CompleteMetaSignupInput = z.infer<typeof completeMetaSignupSchema>;

export const disconnectMetaSchema = z.object({
  workspaceId: z.string().uuid(),
  connectionId: z.string().uuid(),
});

export type DisconnectMetaInput = z.infer<typeof disconnectMetaSchema>;

export const syncMetaConnectionSchema = z.object({
  workspaceId: z.string().uuid(),
  connectionId: z.string().uuid(),
});

export type SyncMetaConnectionInput = z.infer<typeof syncMetaConnectionSchema>;

export const registerPhoneNumberSchema = z.object({
  workspaceId: z.string().uuid(),
  phoneNumberRowId: z.string().uuid(),
});

export type RegisterPhoneNumberInput = z.infer<typeof registerPhoneNumberSchema>;
