import { z } from "zod";

export const mappingSchema = z.object({
  phoneColumn: z.string().min(1, "Selecione a coluna do telefone"),
  fullNameColumn: z.string().nullable().optional(),
  customColumns: z
    .array(
      z.object({
        sourceHeader: z.string().min(1),
        fieldKey: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-z0-9_]+$/i, "Use só letras, números e underscore"),
      }),
    )
    .default([]),
});

export type ImportMapping = z.infer<typeof mappingSchema>;

export const updateContactSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().max(200).nullable(),
  custom_fields: z.record(z.string(), z.string()),
  tags: z.array(z.string().min(1).max(50)).max(50),
});

export const toggleOptOutSchema = z.object({
  id: z.string().uuid(),
  opt_out: z.boolean(),
});

export const deleteContactSchema = z.object({
  id: z.string().uuid(),
});

export const listContactsSchema = z.object({
  search: z.string().optional().default(""),
  optOutFilter: z.enum(["all", "active", "opt_out"]).optional().default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});

export type ListContactsParams = z.infer<typeof listContactsSchema>;
