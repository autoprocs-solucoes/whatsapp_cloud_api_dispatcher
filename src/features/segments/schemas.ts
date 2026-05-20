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
  "not_contains",
  "starts_with",
  "ends_with",
  "in",
  "not_in",
  "has_tag",
  "not_has_tag",
  "is_empty",
  "is_not_empty",
]);

const TAG_OPS = ["has_tag", "not_has_tag"] as const;
const LIST_OPS = ["in", "not_in"] as const;
const EMPTY_OPS = ["is_empty", "is_not_empty"] as const;
const TEXT_OPS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
] as const;

export const ruleSchema = z
  .object({
    field: fieldSchema,
    op: opSchema,
    value: z.union([z.string(), z.array(z.string().min(1)).min(1).max(100)]).optional(),
  })
  .superRefine((rule, ctx) => {
    const isTagOp = (TAG_OPS as readonly string[]).includes(rule.op);
    const isListOp = (LIST_OPS as readonly string[]).includes(rule.op);
    const isEmptyOp = (EMPTY_OPS as readonly string[]).includes(rule.op);
    const isTextOp = (TEXT_OPS as readonly string[]).includes(rule.op);

    if (isTagOp && rule.field.kind !== "tags") {
      ctx.addIssue({
        code: "custom",
        message: "Operadores de tag só aceitam o campo 'tags'",
        path: ["op"],
      });
    }
    if (rule.field.kind === "tags" && !isTagOp && !isEmptyOp) {
      ctx.addIssue({
        code: "custom",
        message: "Campo 'tags' só aceita has_tag/not_has_tag ou vazio/preenchido",
        path: ["op"],
      });
    }
    if (isListOp && !Array.isArray(rule.value)) {
      ctx.addIssue({ code: "custom", message: "Operador de lista exige array", path: ["value"] });
    }
    if (isTextOp && (rule.value === undefined || Array.isArray(rule.value))) {
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
