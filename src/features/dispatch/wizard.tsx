"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, Send, TestTube } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxGroup } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDispatchAction,
  previewRecipientsAction,
  testSendAction,
} from "@/features/dispatch/actions";
import type { VariableColumn, VariableMapping } from "@/features/dispatch/schemas";
import {
  WhatsAppPreview,
  type PreviewButton,
} from "@/features/dispatch/whatsapp-preview";
import { extractPlaceholders } from "@/lib/meta/placeholders";
import { cn } from "@/lib/utils";
import type {
  Segment,
  Template,
  WorkspacePhoneNumber,
} from "@/lib/supabase/database.types";

const ATTR_LABELS: Record<string, string> = {
  full_name: "Nome",
  phone_e164: "Telefone",
};

function columnLabel(id: string): string {
  if (id.startsWith("attr:")) return ATTR_LABELS[id.slice(5)] ?? id.slice(5);
  if (id.startsWith("custom:")) return id.slice(7);
  return id;
}

type Props = {
  templates: Template[];
  phoneNumbers: WorkspacePhoneNumber[];
  segments: Segment[];
  customKeys: string[];
};

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Template" },
  { id: 2, label: "Remetente" },
  { id: 3, label: "Variáveis" },
  { id: 4, label: "Destinatários" },
  { id: 5, label: "Teste" },
  { id: 6, label: "Revisão" },
];

type ColumnId = string; // "attr:full_name" | "attr:phone_e164" | "custom:<key>"

function decodeColumn(id: ColumnId): VariableColumn | null {
  if (id === "attr:full_name") return { kind: "attr", name: "full_name" };
  if (id === "attr:phone_e164") return { kind: "attr", name: "phone_e164" };
  if (id.startsWith("custom:")) {
    const key = id.slice(7);
    if (!key) return null;
    return { kind: "custom", key };
  }
  return null;
}

export function DispatchWizard({ templates, phoneNumbers, segments, customKeys }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();

  const [templateId, setTemplateId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [mappingState, setMappingState] = useState<
    Record<string, { columnId: ColumnId; fallback: string }>
  >({});
  const [recipientSource, setRecipientSource] = useState<"segment" | "manual">("segment");
  const [segmentId, setSegmentId] = useState("");
  const [manualPhonesText, setManualPhonesText] = useState("");
  const [testPhone, setTestPhone] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const headerPlaceholders = useMemo(
    () => extractPlaceholders(selectedTemplate?.header_text),
    [selectedTemplate],
  );
  const bodyPlaceholders = useMemo(
    () => extractPlaceholders(selectedTemplate?.body_text),
    [selectedTemplate],
  );

  const allMappingKeys = useMemo(
    () => [
      ...headerPlaceholders.map((p) => ({ component: "header" as const, num: p })),
      ...bodyPlaceholders.map((p) => ({ component: "body" as const, num: p })),
    ],
    [headerPlaceholders, bodyPlaceholders],
  );

  const variableMapping: VariableMapping = useMemo(() => {
    const out: VariableMapping = {};
    for (const m of allMappingKeys) {
      const key = `${m.component}:${m.num}`;
      const s = mappingState[key];
      if (!s) continue;
      const col = decodeColumn(s.columnId);
      if (!col) continue;
      out[key] = { column: col, fallback: s.fallback };
    }
    return out;
  }, [allMappingKeys, mappingState]);

  function updateMapping(key: string, patch: Partial<{ columnId: ColumnId; fallback: string }>) {
    setMappingState((s) => ({
      ...s,
      [key]: { columnId: "", fallback: "", ...s[key], ...patch },
    }));
  }

  const templateOptions = templates.map((t) => ({
    value: t.id,
    label: t.name,
    hint: `${t.language} · ${t.category}`,
  }));

  const phoneOptions = phoneNumbers.map((p) => ({
    value: p.phone_number_id,
    label: p.display_phone_number,
    hint: p.verified_name ?? undefined,
  }));

  const segmentOptions = segments.map((s) => ({ value: s.id, label: s.name }));

  // Para o preview: fallback se preenchido, senão usa o label da coluna.
  const previewResolved = useMemo(() => {
    const out: Record<string, string> = {};
    for (const m of allMappingKeys) {
      const key = `${m.component}:${m.num}`;
      const s = mappingState[key];
      if (s?.fallback && s.fallback.length > 0) out[key] = s.fallback;
    }
    return out;
  }, [allMappingKeys, mappingState]);

  const previewLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const m of allMappingKeys) {
      const key = `${m.component}:${m.num}`;
      const s = mappingState[key];
      if (s?.columnId) out[key] = `[${columnLabel(s.columnId)}]`;
    }
    return out;
  }, [allMappingKeys, mappingState]);

  const previewButtons: PreviewButton[] = useMemo(() => {
    const raw = selectedTemplate?.buttons;
    if (!Array.isArray(raw)) return [];
    return (raw as { type?: string; text?: string }[])
      .filter((b) => typeof b?.text === "string")
      .map((b) => ({ type: b.type ?? "QUICK_REPLY", text: b.text! }));
  }, [selectedTemplate]);

  const previewSenderName = useMemo(() => {
    const num = phoneNumbers.find((p) => p.phone_number_id === phoneNumberId);
    return num?.verified_name ?? num?.display_phone_number ?? "Empresa";
  }, [phoneNumbers, phoneNumberId]);

  const columnGroups: ComboboxGroup[] = [
    {
      options: [
        { value: "attr:full_name", label: "Nome" },
        { value: "attr:phone_e164", label: "Telefone (E.164)" },
      ],
    },
    customKeys.length > 0
      ? {
          label: "Custom",
          options: customKeys.map((k) => ({ value: `custom:${k}`, label: k })),
        }
      : { options: [] },
  ].filter((g) => g.options.length > 0);

  // Validação por step
  const canAdvance = useMemo(() => {
    if (step === 1) return Boolean(templateId);
    if (step === 2) return Boolean(phoneNumberId);
    if (step === 3) {
      return allMappingKeys.every((m) => {
        const s = mappingState[`${m.component}:${m.num}`];
        return s && decodeColumn(s.columnId);
      });
    }
    if (step === 4) {
      if (recipientSource === "segment") return Boolean(segmentId);
      return manualPhonesText.trim().length > 0;
    }
    if (step === 5) return true; // teste é opcional
    return true;
  }, [
    step,
    templateId,
    phoneNumberId,
    allMappingKeys,
    mappingState,
    recipientSource,
    segmentId,
    manualPhonesText,
  ]);

  function buildBaseFormData(): FormData {
    const fd = new FormData();
    fd.append("template_id", templateId);
    fd.append("phone_number_id", phoneNumberId);
    fd.append("recipient_source", recipientSource);
    if (recipientSource === "segment") fd.append("segment_id", segmentId);
    if (recipientSource === "manual") fd.append("manual_phones", manualPhonesText);
    fd.append("variable_mapping", JSON.stringify(variableMapping));
    return fd;
  }

  function handleTestSend() {
    if (!testPhone.trim()) {
      toast.error("Informe o telefone para o teste");
      return;
    }
    const fd = new FormData();
    fd.append("template_id", templateId);
    fd.append("phone_number_id", phoneNumberId);
    fd.append("to_phone", testPhone);
    fd.append("variable_mapping", JSON.stringify(variableMapping));
    startTransition(async () => {
      const res = await testSendAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Teste enviado (id ${res.data.messageId.slice(0, 12)}…)`);
    });
  }

  const [previewResult, setPreviewResult] = useState<{
    resolved: number;
    optOut: number;
    invalid: number;
    unknown: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  function handlePreview() {
    const fd = buildBaseFormData();
    setPreviewLoading(true);
    startTransition(async () => {
      const res = await previewRecipientsAction(fd);
      setPreviewLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        setPreviewResult(null);
        return;
      }
      setPreviewResult({
        resolved: res.data.stats.resolved,
        optOut: res.data.stats.filtered_opt_out,
        invalid: res.data.stats.invalid_phones,
        unknown: res.data.stats.unknown_phones,
      });
    });
  }

  function handleConfirm() {
    const fd = buildBaseFormData();
    startTransition(async () => {
      const res = await createDispatchAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Comunicado criado em rascunho");
      router.push(`/comunicados/${res.data.id}`);
    });
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => done && setStep(s.id)}
                disabled={!done && !active}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                  active && "border-primary text-primary bg-primary/5",
                  done && "border-primary text-primary",
                  !active && !done && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                    active && "bg-primary text-primary-foreground",
                    done && "bg-primary text-primary-foreground",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" /> : s.id}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <span className="text-muted-foreground">·</span>}
            </li>
          );
        })}
      </ol>

      {/* Step content + preview side-by-side */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-md border p-5">
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template aprovado</Label>
              <Combobox
                value={templateId}
                onChange={setTemplateId}
                options={templateOptions}
                placeholder={
                  templates.length === 0 ? "Nenhum template APPROVED" : "Selecione…"
                }
                searchPlaceholder="Buscar template…"
                triggerClassName="w-full max-w-md"
              />
            </div>
            {selectedTemplate && (
              <div className="bg-muted/40 space-y-2 rounded-md p-3 text-sm">
                {selectedTemplate.header_text && (
                  <p>
                    <span className="text-muted-foreground text-[10px] uppercase">Header </span>
                    {selectedTemplate.header_text}
                  </p>
                )}
                {selectedTemplate.body_text && (
                  <p className="whitespace-pre-wrap">
                    <span className="text-muted-foreground text-[10px] uppercase">Body </span>
                    {selectedTemplate.body_text}
                  </p>
                )}
                {selectedTemplate.footer_text && (
                  <p className="text-muted-foreground text-xs">
                    {selectedTemplate.footer_text}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label>Número remetente (WABA)</Label>
            <Combobox
              value={phoneNumberId}
              onChange={setPhoneNumberId}
              options={phoneOptions}
              placeholder={
                phoneNumbers.length === 0
                  ? "Nenhum número conectado"
                  : "Selecione…"
              }
              searchPlaceholder="Buscar número…"
              triggerClassName="w-full max-w-md"
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {allMappingKeys.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Esse template não tem placeholders. Pode seguir.
              </p>
            ) : (
              allMappingKeys.map((m) => {
                const key = `${m.component}:${m.num}`;
                const v = mappingState[key];
                return (
                  <div key={key} className="grid gap-2 sm:grid-cols-[140px_1fr_1fr] sm:items-end">
                    <div>
                      <Label className="text-xs">
                        {`{{${m.num}}}`}{" "}
                        <span className="text-muted-foreground">({m.component})</span>
                      </Label>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-[10px]">Coluna</span>
                      <Combobox
                        value={v?.columnId ?? ""}
                        onChange={(id) => updateMapping(key, { columnId: id })}
                        groups={columnGroups}
                        placeholder="Coluna do contato"
                        searchPlaceholder="Buscar coluna…"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-[10px]">Fallback</span>
                      <Input
                        value={v?.fallback ?? ""}
                        onChange={(e) => updateMapping(key, { fallback: e.target.value })}
                        placeholder="valor padrão se vazio"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-muted/40 inline-flex rounded-md p-0.5">
              {(["segment", "manual"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRecipientSource(s)}
                  className={cn(
                    "rounded px-3 py-1 text-sm",
                    recipientSource === s
                      ? "bg-background shadow-xs"
                      : "text-muted-foreground",
                  )}
                >
                  {s === "segment" ? "Segmento salvo" : "Lista manual"}
                </button>
              ))}
            </div>

            {recipientSource === "segment" ? (
              <div className="space-y-2">
                <Label>Segmento</Label>
                <Combobox
                  value={segmentId}
                  onChange={setSegmentId}
                  options={segmentOptions}
                  placeholder={
                    segments.length === 0
                      ? "Nenhum segmento criado ainda"
                      : "Selecione…"
                  }
                  searchPlaceholder="Buscar segmento…"
                  triggerClassName="w-full max-w-md"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Telefones (um por linha)</Label>
                <textarea
                  value={manualPhonesText}
                  onChange={(e) => setManualPhonesText(e.target.value)}
                  rows={8}
                  placeholder="61999999999\n(11) 98765-4321"
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px]"
                />
                <p className="text-muted-foreground text-xs">
                  Normalizamos pra E.164 (default BR). Contatos não cadastrados são incluídos
                  como destinatários sem custom fields.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Telefone para teste</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="61999999999"
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestSend}
                  disabled={isPending || !templateId || !phoneNumberId}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-1 size-4 animate-spin" /> Enviando…
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-1 size-4" /> Enviar teste
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Manda 1 mensagem com o mesmo template + mapping atual. Sem custom fields (usa só
              fallbacks). Pode pular se confiar no template.
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Template:</span>{" "}
                <strong>{selectedTemplate?.name}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Remetente:</span>{" "}
                <strong>
                  {phoneNumbers.find((p) => p.phone_number_id === phoneNumberId)
                    ?.display_phone_number ?? phoneNumberId}
                </strong>
              </p>
              <p>
                <span className="text-muted-foreground">Origem:</span>{" "}
                <strong>
                  {recipientSource === "segment"
                    ? segments.find((s) => s.id === segmentId)?.name
                    : `Lista manual (${manualPhonesText.split(/\n/).filter(Boolean).length} entrada(s))`}
                </strong>
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={previewLoading}
            >
              {previewLoading ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" /> Calculando…
                </>
              ) : (
                "Pré-visualizar destinatários"
              )}
            </Button>

            {previewResult && (
              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-md border p-2 text-center">
                  <p className="text-muted-foreground text-[10px]">VÁLIDOS</p>
                  <p className="text-foreground text-lg font-semibold">{previewResult.resolved}</p>
                </div>
                <div className="rounded-md border p-2 text-center">
                  <p className="text-muted-foreground text-[10px]">OPT-OUT</p>
                  <p className="text-foreground text-lg font-semibold">{previewResult.optOut}</p>
                </div>
                <div className="rounded-md border p-2 text-center">
                  <p className="text-muted-foreground text-[10px]">INVÁLIDOS</p>
                  <p className="text-foreground text-lg font-semibold">{previewResult.invalid}</p>
                </div>
                <div className="rounded-md border p-2 text-center">
                  <p className="text-muted-foreground text-[10px]">NÃO CADASTRADOS</p>
                  <p className="text-foreground text-lg font-semibold">
                    {previewResult.unknown}
                  </p>
                </div>
              </div>
            )}

            <div className="border-primary/20 bg-primary/5 rounded-md border p-3 text-xs">
              Ao confirmar criamos o comunicado em <strong>rascunho</strong> e te
              redirecionamos pra página dele, onde tem o botão pra disparar.
            </div>
          </div>
        )}
      </div>

        {/* WhatsApp preview pane */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Prévia no WhatsApp
            </p>
            {selectedTemplate && (
              <span className="text-muted-foreground text-[10px]">
                {selectedTemplate.language}
              </span>
            )}
          </div>
          <WhatsAppPreview
            senderName={previewSenderName}
            headerText={selectedTemplate?.header_text ?? null}
            bodyText={selectedTemplate?.body_text ?? null}
            footerText={selectedTemplate?.footer_text ?? null}
            buttons={previewButtons}
            resolved={previewResolved}
            placeholderLabels={previewLabels}
          />
          {selectedTemplate && (
            <p className="text-muted-foreground mt-2 text-center text-[10px]">
              <span className="rounded bg-amber-200/40 px-1 dark:bg-amber-500/20">amarelo</span> = fallback ·{" "}
              <span className="rounded bg-blue-200/40 px-1 dark:bg-blue-500/20">azul</span> = coluna do contato
            </p>
          )}
        </aside>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1 || isPending}
        >
          <ChevronLeft className="mr-1 size-4" /> Voltar
        </Button>

        {step < 6 ? (
          <Button
            type="button"
            onClick={() => setStep((s) => ((s + 1) as Step))}
            disabled={!canAdvance || isPending}
          >
            Avançar <ChevronRight className="ml-1 size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" /> Criando…
              </>
            ) : (
              <>
                <Send className="mr-1 size-4" /> Confirmar e criar
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
