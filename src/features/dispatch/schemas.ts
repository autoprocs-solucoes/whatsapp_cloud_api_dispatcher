import { z } from "zod";

export const variableColumnSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("attr"), name: z.enum(["full_name", "phone_e164"]) }),
  z.object({
    kind: z.literal("custom"),
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_]+$/i, "Use só letras, números e underscore"),
  }),
]);

export const variableMappingEntrySchema = z.object({
  column: variableColumnSchema,
  fallback: z.string().max(500).default(""),
});

// Key format: "header:N" or "body:N" — Meta numera placeholders por componente.
export const variableMappingSchema = z.record(
  z.string().regex(/^(header|body):\d+$/),
  variableMappingEntrySchema,
);

export const recipientSourceSchema = z.enum(["segment", "manual"]);

export const createDispatchSchema = z
  .object({
    template_id: z.string().uuid(),
    phone_number_id: z.string().min(1),
    recipient_source: recipientSourceSchema,
    segment_id: z.string().uuid().nullable().optional(),
    manual_phones: z.array(z.string().min(1)).max(5000).default([]),
    variable_mapping: variableMappingSchema.default({}),
  })
  .superRefine((d, ctx) => {
    if (d.recipient_source === "segment" && !d.segment_id) {
      ctx.addIssue({ code: "custom", message: "Selecione um segmento", path: ["segment_id"] });
    }
    if (d.recipient_source === "manual" && d.manual_phones.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe pelo menos um telefone",
        path: ["manual_phones"],
      });
    }
  });

export const executeDispatchSchema = z.object({ id: z.string().uuid() });

export const testSendSchema = z.object({
  template_id: z.string().uuid(),
  phone_number_id: z.string().min(1),
  to_phone: z.string().min(1),
  variable_mapping: variableMappingSchema.default({}),
});

export type VariableColumn = z.infer<typeof variableColumnSchema>;
export type VariableMappingEntry = z.infer<typeof variableMappingEntrySchema>;
export type VariableMapping = z.infer<typeof variableMappingSchema>;
export type RecipientSource = z.infer<typeof recipientSourceSchema>;
export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
export type TestSendInput = z.infer<typeof testSendSchema>;
