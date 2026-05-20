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

function emptyLiteral(rule: Rule): string {
  return rule.field.kind === "tags" ? "{}" : quoteForOr("");
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
    case "not_contains":
      return `${col}.not.ilike.${quoteForOr(`%${String(rule.value)}%`)}`;
    case "starts_with":
      return `${col}.ilike.${quoteForOr(`${String(rule.value)}%`)}`;
    case "ends_with":
      return `${col}.ilike.${quoteForOr(`%${String(rule.value)}`)}`;
    case "in": {
      const list = (rule.value as string[]).map(quoteForOr).join(",");
      return `${col}.in.(${list})`;
    }
    case "not_in": {
      const list = (rule.value as string[]).map(quoteForOr).join(",");
      return `${col}.not.in.(${list})`;
    }
    case "has_tag":
      return `tags.cs.{${quoteForOr(String(rule.value))}}`;
    case "not_has_tag":
      return `not.tags.cs.{${quoteForOr(String(rule.value))}}`;
    case "is_empty":
      return `or(${col}.is.null,${col}.eq.${emptyLiteral(rule)})`;
    case "is_not_empty":
      return `and(${col}.not.is.null,${col}.neq.${emptyLiteral(rule)})`;
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
    const empty = emptyLiteral(rule);
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
      case "not_contains":
        q = q.not(col, "ilike", `%${String(rule.value)}%`);
        break;
      case "starts_with":
        q = q.ilike(col, `${String(rule.value)}%`);
        break;
      case "ends_with":
        q = q.ilike(col, `%${String(rule.value)}`);
        break;
      case "in":
        q = q.in(col, rule.value as string[]);
        break;
      case "not_in": {
        const list = (rule.value as string[]).map(quoteForOr).join(",");
        q = q.not(col, "in", `(${list})`);
        break;
      }
      case "has_tag":
        q = q.contains("tags", [String(rule.value)]);
        break;
      case "not_has_tag":
        q = q.not("tags", "cs", `{${String(rule.value)}}`);
        break;
      case "is_empty":
        q = q.or(`${col}.is.null,${col}.eq.${empty}`);
        break;
      case "is_not_empty":
        q = q.or(`and(${col}.not.is.null,${col}.neq.${empty})`);
        break;
    }
  }

  return q;
}
