import { z } from "zod";

export const fieldSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("attr"), name: z.enum(["full_name", "phone_e164"]) }),
  z.object({
    kind: z.literal("custom"),
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_]+$/i, "Use só letras, números e underscore"),
  }),
  z.object({ kind: z.literal("tags") }),
]);

export const opSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "in",
  "has_tag",
  "not_has_tag",
]);

export const ruleSchema = z
  .object({
    field: fieldSchema,
    op: opSchema,
    value: z.union([z.string(), z.array(z.string().min(1)).min(1).max(100)]),
  })
  .superRefine((rule, ctx) => {
    const isTagOp = rule.op === "has_tag" || rule.op === "not_has_tag";
    const isListOp = rule.op === "in";
    const isTextOp = !isTagOp && !isListOp;

    if (isTagOp && rule.field.kind !== "tags") {
      ctx.addIssue({
        code: "custom",
        message: "Operadores de tag só aceitam o campo 'tags'",
        path: ["op"],
      });
    }
    if (!isTagOp && rule.field.kind === "tags") {
      ctx.addIssue({
        code: "custom",
        message: "Campo 'tags' só aceita has_tag/not_has_tag",
        path: ["op"],
      });
    }
    if (isListOp && !Array.isArray(rule.value)) {
      ctx.addIssue({ code: "custom", message: "Operador 'in' exige lista", path: ["value"] });
    }
    if (isTextOp && Array.isArray(rule.value)) {
      ctx.addIssue({
        code: "custom",
        message: "Operadores de texto exigem valor string",
        path: ["value"],
      });
    }
    if (isTagOp && typeof rule.value !== "string") {
      ctx.addIssue({
        code: "custom",
        message: "Operadores de tag exigem valor string",
        path: ["value"],
      });
    }
  });

export const rulesSchema = z.object({
  match: z.enum(["and", "or"]),
  rules: z.array(ruleSchema).max(50),
});

export const segmentNameSchema = z.string().trim().min(1, "Nome obrigatório").max(120);

export const createSegmentSchema = z.object({
  name: segmentNameSchema,
  rules: rulesSchema,
});

export const updateSegmentSchema = createSegmentSchema.extend({
  id: z.string().uuid(),
});

export const deleteSegmentSchema = z.object({ id: z.string().uuid() });

export type Field = z.infer<typeof fieldSchema>;
export type Op = z.infer<typeof opSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type Rules = z.infer<typeof rulesSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;

export const EMPTY_RULES: Rules = { match: "and", rules: [] };
