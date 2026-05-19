"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxGroup } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSegmentAction,
  previewCountAction,
  updateSegmentAction,
} from "@/features/segments/actions";
import {
  rulesSchema,
  type Field,
  type Op,
  type Rule,
  type Rules,
} from "@/features/segments/schemas";
import { cn } from "@/lib/utils";

type EditorRule = {
  uid: string;
  fieldId: string;
  customKeyInput: string;
  op: Op;
  valueText: string;
  valueList: string[];
};

type Initial = {
  id: string;
  name: string;
  rules: Rules;
};

type Props =
  | { mode: "create"; customKeys: string[]; initial?: undefined }
  | { mode: "edit"; customKeys: string[]; initial: Initial };

const FIELD_OPTIONS: { id: string; label: string }[] = [
  { id: "attr:full_name", label: "Nome" },
  { id: "attr:phone_e164", label: "Telefone (E.164)" },
  { id: "tags", label: "Tags" },
];

const CUSTOM_OTHER_ID = "custom:__other__";

const OP_LABELS: Record<Op, string> = {
  equals: "é igual a",
  not_equals: "diferente de",
  contains: "contém",
  in: "está em",
  has_tag: "tem tag",
  not_has_tag: "não tem tag",
};

function makeUid() {
  return Math.random().toString(36).slice(2, 10);
}

function fieldFromRule(rule: Rule): { fieldId: string; customKeyInput: string } {
  if (rule.field.kind === "attr") {
    return { fieldId: `attr:${rule.field.name}`, customKeyInput: "" };
  }
  if (rule.field.kind === "tags") {
    return { fieldId: "tags", customKeyInput: "" };
  }
  return { fieldId: `custom:${rule.field.key}`, customKeyInput: rule.field.key };
}

function opsForField(fieldId: string): Op[] {
  if (fieldId === "tags") return ["has_tag", "not_has_tag"];
  return ["equals", "not_equals", "contains", "in"];
}

function ruleToEditor(rule: Rule): EditorRule {
  const { fieldId, customKeyInput } = fieldFromRule(rule);
  const isList = Array.isArray(rule.value);
  return {
    uid: makeUid(),
    fieldId,
    customKeyInput,
    op: rule.op,
    valueText: isList ? "" : String(rule.value),
    valueList: isList ? (rule.value as string[]) : [],
  };
}

function emptyEditorRule(): EditorRule {
  return {
    uid: makeUid(),
    fieldId: "attr:full_name",
    customKeyInput: "",
    op: "equals",
    valueText: "",
    valueList: [],
  };
}

function buildField(fieldId: string, customKeyInput: string): Field | null {
  if (fieldId === "tags") return { kind: "tags" };
  if (fieldId.startsWith("attr:")) {
    const name = fieldId.slice(5);
    if (name === "full_name" || name === "phone_e164") return { kind: "attr", name };
    return null;
  }
  if (fieldId === CUSTOM_OTHER_ID) {
    const key = customKeyInput.trim();
    if (!key) return null;
    return { kind: "custom", key };
  }
  if (fieldId.startsWith("custom:")) {
    const key = fieldId.slice(7);
    if (!key) return null;
    return { kind: "custom", key };
  }
  return null;
}

function buildRule(r: EditorRule): Rule | null {
  const field = buildField(r.fieldId, r.customKeyInput);
  if (!field) return null;

  if (r.op === "in") {
    if (r.valueList.length === 0) return null;
    return { field, op: r.op, value: r.valueList };
  }

  const text = r.valueText.trim();
  if (!text) return null;
  return { field, op: r.op, value: text };
}

function buildRules(match: "and" | "or", editorRules: EditorRule[]): Rules | null {
  const out: Rule[] = [];
  for (const r of editorRules) {
    const built = buildRule(r);
    if (!built) return null;
    out.push(built);
  }
  const candidate = { match, rules: out };
  const parsed = rulesSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function SegmentEditor(props: Props) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();

  const initialEditorRules = useMemo<EditorRule[]>(() => {
    if (props.mode === "edit" && props.initial.rules.rules.length > 0) {
      return props.initial.rules.rules.map(ruleToEditor);
    }
    return [emptyEditorRule()];
  }, [props]);

  const [name, setName] = useState(props.mode === "edit" ? props.initial.name : "");
  const [match, setMatch] = useState<"and" | "or">(
    props.mode === "edit" ? props.initial.rules.match : "and",
  );
  const [rules, setRules] = useState<EditorRule[]>(initialEditorRules);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const compiledRules = useMemo(() => buildRules(match, rules), [match, rules]);
  const compiledRulesJson = compiledRules ? JSON.stringify(compiledRules) : null;

  useEffect(() => {
    if (!compiledRulesJson) {
      setPreviewCount(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const handle = setTimeout(async () => {
      const res = await previewCountAction(compiledRulesJson);
      if (cancelled) return;
      setPreviewLoading(false);
      if (!res.ok) {
        setPreviewError(res.error);
        setPreviewCount(null);
      } else {
        setPreviewError(null);
        setPreviewCount(res.data.count);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(handle);
      setPreviewLoading(false);
    };
  }, [compiledRulesJson]);

  function updateRule(uid: string, patch: Partial<EditorRule>) {
    setRules((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  function handleFieldChange(uid: string, fieldId: string) {
    const allowed = opsForField(fieldId);
    setRules((rs) =>
      rs.map((r) => {
        if (r.uid !== uid) return r;
        const op = allowed.includes(r.op) ? r.op : allowed[0]!;
        return { ...r, fieldId, op, valueText: "", valueList: [] };
      }),
    );
  }

  function handleOpChange(uid: string, op: Op) {
    setRules((rs) =>
      rs.map((r) => {
        if (r.uid !== uid) return r;
        if (op === "in") return { ...r, op, valueText: "" };
        return { ...r, op, valueList: [] };
      }),
    );
  }

  function handleAddRule() {
    setRules((rs) => [...rs, emptyEditorRule()]);
  }

  function handleRemoveRule(uid: string) {
    setRules((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.uid !== uid)));
  }

  const customOptions = props.customKeys;

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Informe um nome para o segmento");
      return;
    }
    if (!compiledRules) {
      toast.error("Existe alguma regra incompleta");
      return;
    }

    const fd = new FormData();
    fd.append("name", trimmed);
    fd.append("rules", JSON.stringify(compiledRules));

    startSaving(async () => {
      if (props.mode === "edit") {
        fd.append("id", props.initial.id);
        const res = await updateSegmentAction(fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Segmento atualizado");
        router.push("/segmentos");
        router.refresh();
      } else {
        const res = await createSegmentAction(fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Segmento criado");
        router.push("/segmentos");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do segmento</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Clientes ativos São Paulo"
          maxLength={120}
        />
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Casar quando</span>
            <div className="bg-muted/40 inline-flex rounded-md p-0.5">
              {(["and", "or"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMatch(m)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium uppercase",
                    match === m ? "bg-background shadow-xs" : "text-muted-foreground",
                  )}
                >
                  {m === "and" ? "todas (E)" : "qualquer (OU)"}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground">as regras forem verdadeiras</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Users className="size-3.5" />
            {previewLoading ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                contando…
              </span>
            ) : previewError ? (
              <span className="text-destructive">{previewError}</span>
            ) : previewCount !== null ? (
              <span>
                <strong className="text-foreground">{previewCount}</strong> contato(s) (já
                descontados opt-outs)
              </span>
            ) : (
              <span>Complete as regras pra ver a prévia</span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {rules.map((r, i) => {
            const allowedOps = opsForField(r.fieldId);
            const isCustomOther = r.fieldId === CUSTOM_OTHER_ID;
            const isInOp = r.op === "in";

            const fieldGroups: ComboboxGroup[] = [
              { options: FIELD_OPTIONS.map((f) => ({ value: f.id, label: f.label })) },
            ];
            const customGroupOptions = [
              ...customOptions.map((k) => ({ value: `custom:${k}`, label: k })),
              { value: CUSTOM_OTHER_ID, label: "Outra chave…" },
            ];
            fieldGroups.push({ label: "Campo custom", options: customGroupOptions });

            const opOptions = allowedOps.map((op) => ({ value: op, label: OP_LABELS[op] }));

            return (
              <div
                key={r.uid}
                className="flex flex-wrap items-start gap-2 rounded-md border bg-background p-3"
              >
                <span className="text-muted-foreground self-center text-[10px] uppercase">
                  {i === 0 ? "onde" : match === "and" ? "e" : "ou"}
                </span>

                <Combobox
                  value={r.fieldId}
                  onChange={(v) => handleFieldChange(r.uid, v)}
                  groups={fieldGroups}
                  placeholder="Campo"
                  searchPlaceholder="Buscar campo…"
                  triggerClassName="min-w-[180px]"
                />

                {isCustomOther && (
                  <Input
                    value={r.customKeyInput}
                    onChange={(e) => updateRule(r.uid, { customKeyInput: e.target.value })}
                    placeholder="nome_da_chave"
                    className="h-9 w-40 text-sm"
                  />
                )}

                <Combobox
                  value={r.op}
                  onChange={(v) => handleOpChange(r.uid, v as Op)}
                  options={opOptions}
                  placeholder="Operador"
                  searchPlaceholder="Buscar operador…"
                  triggerClassName="min-w-[160px]"
                />

                {isInOp ? (
                  <Input
                    value={r.valueList.join(", ")}
                    onChange={(e) =>
                      updateRule(r.uid, {
                        valueList: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="valor1, valor2, valor3"
                    className="h-9 min-w-[200px] flex-1 text-sm"
                  />
                ) : (
                  <Input
                    value={r.valueText}
                    onChange={(e) => updateRule(r.uid, { valueText: e.target.value })}
                    placeholder="valor"
                    className="h-9 min-w-[160px] flex-1 text-sm"
                  />
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRule(r.uid)}
                  disabled={rules.length === 1}
                  title="Remover regra"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={handleAddRule}>
          <Plus className="mr-1 size-3.5" /> Adicionar regra
        </Button>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/segmentos")}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !compiledRules}>
          {isSaving ? (
            <>
              <Loader2 className="mr-1 size-4 animate-spin" /> Salvando…
            </>
          ) : props.mode === "edit" ? (
            "Salvar alterações"
          ) : (
            "Criar segmento"
          )}
        </Button>
      </div>
    </div>
  );
}
