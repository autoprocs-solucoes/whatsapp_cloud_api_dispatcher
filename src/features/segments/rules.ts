import type { Rule, Rules } from "./schemas";

function fieldColumn(rule: Rule): string {
  switch (rule.field.kind) {
    case "attr":
      return rule.field.name;
    case "custom":
      return `custom_fields->>${rule.field.key}`;
    case "tags":
      return "tags";
  }
}

function quoteForOr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function ruleToOrFragment(rule: Rule): string {
  const col = fieldColumn(rule);
  switch (rule.op) {
    case "equals":
      return `${col}.eq.${quoteForOr(String(rule.value))}`;
    case "not_equals":
      return `${col}.neq.${quoteForOr(String(rule.value))}`;
    case "contains":
      return `${col}.ilike.${quoteForOr(`%${String(rule.value)}%`)}`;
    case "in": {
      const list = (rule.value as string[]).map(quoteForOr).join(",");
      return `${col}.in.(${list})`;
    }
    case "has_tag":
      return `tags.cs.{${quoteForOr(String(rule.value))}}`;
    case "not_has_tag":
      return `not.tags.cs.{${quoteForOr(String(rule.value))}}`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

/**
 * Aplica filtros do segmento à query do supabase-js sobre a tabela `contact`.
 * Sempre filtra opt_out=false automaticamente.
 */
export function applyRules(query: AnyQuery, rules: Rules): AnyQuery {
  let q: AnyQuery = query.eq("opt_out", false);

  if (rules.rules.length === 0) return q;

  if (rules.match === "or") {
    const expr = rules.rules.map(ruleToOrFragment).join(",");
    return q.or(expr);
  }

  for (const rule of rules.rules) {
    const col = fieldColumn(rule);
    switch (rule.op) {
      case "equals":
        q = q.eq(col, String(rule.value));
        break;
      case "not_equals":
        q = q.neq(col, String(rule.value));
        break;
      case "contains":
        q = q.ilike(col, `%${String(rule.value)}%`);
        break;
      case "in":
        q = q.in(col, rule.value as string[]);
        break;
      case "has_tag":
        q = q.contains("tags", [String(rule.value)]);
        break;
      case "not_has_tag":
        q = q.not("tags", "cs", `{${String(rule.value)}}`);
        break;
    }
  }

  return q;
}
