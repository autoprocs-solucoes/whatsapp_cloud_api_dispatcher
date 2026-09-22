import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome do workspace muito curto")
    .max(80, "Nome muito longo"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().trim().email("Email inválido"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const removeMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export const updateMemberRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "member"]),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
