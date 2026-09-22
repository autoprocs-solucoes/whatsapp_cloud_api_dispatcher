import { z } from "zod";

/** Itens por página na listagem de contatos. Mesmo passo usado em segmentos e
 * transmissões. */
export const CONTACTS_PAGE_SIZE = 10;

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

export const createContactSchema = z.object({
  phone: z.string().min(1, "Telefone obrigatório"),
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

export const bulkDeleteContactsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export const contactFiltersSchema = z.object({
  search: z.string().optional().default(""),
  optOutFilter: z.enum(["all", "active", "opt_out"]).optional().default("all"),
});

export type ContactFilters = z.infer<typeof contactFiltersSchema>;

export const listContactsSchema = contactFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(CONTACTS_PAGE_SIZE),
});

export type ListContactsParams = z.infer<typeof listContactsSchema>;
