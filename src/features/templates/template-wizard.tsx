"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Phone,
  Plus,
  Reply,
  Trash2,
  Type,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTemplateAction, uploadTemplateHeaderAction } from "@/features/templates/actions";
import {
  CATEGORY_DESCRIPTION,
  CATEGORY_LABEL,
  TEMPLATE_CATEGORIES,
  type TemplateButtonInput,
  type TemplateCategory,
  type TemplateHeaderType,
} from "@/features/templates/schemas";
import { WhatsAppPreview, type PreviewButton } from "@/features/dispatch/whatsapp-preview";
import { extractPlaceholders } from "@/lib/meta/placeholders";
import { cn } from "@/lib/utils";

/** Idiomas que a Meta aceita, com os mais usados por aqui no topo. */
const LANGUAGES: { value: string; label: string }[] = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "pt_PT", label: "Português (Portugal)" },
  { value: "en_US", label: "Inglês (EUA)" },
  { value: "es_ES", label: "Espanhol (Espanha)" },
  { value: "es_AR", label: "Espanhol (Argentina)" },
  { value: "it", label: "Italiano" },
  { value: "fr", label: "Francês" },
  { value: "de", label: "Alemão" },
];

const CATEGORY_ICON: Record<TemplateCategory, typeof Megaphone> = {
  MARKETING: Megaphone,
  UTILITY: Bell,
  AUTHENTICATION: Check,
};

const HEADER_OPTIONS: { value: TemplateHeaderType; label: string; icon: typeof Type }[] = [
  { value: "NONE", label: "Nenhum", icon: Reply },
  { value: "TEXT", label: "Título", icon: Type },
  { value: "IMAGE", label: "Imagem", icon: ImageIcon },
  { value: "VIDEO", label: "Vídeo", icon: Video },
  { value: "DOCUMENT", label: "Arquivo", icon: FileText },
];

const MEDIA_ACCEPT: Partial<Record<TemplateHeaderType, string>> = {
  IMAGE: "image/jpeg,image/png",
  VIDEO: "video/mp4,video/3gpp",
  DOCUMENT: "application/pdf",
};

type Connection = { id: string; label: string };

type Props = { connections: Connection[] };

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={cn("text-[11px] tabular-nums", value > max ? "text-red" : "text-ink-3")}>
      {value}/{max}
    </span>
  );
}

export function TemplateWizard({ connections }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<TemplateCategory>("MARKETING");
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [headerType, setHeaderType] = useState<TemplateHeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerHandle, setHeaderHandle] = useState("");
  const [headerFileName, setHeaderFileName] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<TemplateButtonInput[]>([]);
  const [examples, setExamples] = useState<Record<string, string>>({});

  const headerPlaceholders = useMemo(
    () => (headerType === "TEXT" ? extractPlaceholders(headerText) : []),
    [headerType, headerText],
  );
  const bodyPlaceholders = useMemo(() => extractPlaceholders(bodyText), [bodyText]);
  const hasVariables = headerPlaceholders.length + bodyPlaceholders.length > 0;

  const previewButtons: PreviewButton[] = buttons.map((b) => ({ type: b.type, text: b.text }));
  const previewResolved = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(examples)) if (v.trim()) out[k] = v;
    return out;
  }, [examples]);

  /** Insere a variável na posição do cursor — sem isso ela sempre cairia no fim. */
  function insertVariable() {
    const el = bodyRef.current;
    const next = bodyPlaceholders.filter((p) => /^[0-9]+$/.test(p)).length + 1;
    const token = `{{${next}}}`;
    if (!el) {
      setBodyText((t) => t + token);
      return;
    }
    const start = el.selectionStart ?? bodyText.length;
    const end = el.selectionEnd ?? bodyText.length;
    setBodyText(bodyText.slice(0, start) + token + bodyText.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function addButton(type: TemplateButtonInput["type"]) {
    if (buttons.length >= 10) {
      toast.error("No máximo 10 botões");
      return;
    }
    if (type === "URL") setButtons((b) => [...b, { type, text: "", url: "" }]);
    else if (type === "PHONE_NUMBER") setButtons((b) => [...b, { type, text: "", phone_number: "" }]);
    else setButtons((b) => [...b, { type, text: "" }]);
  }

  function updateButton(index: number, patch: Partial<TemplateButtonInput>) {
    setButtons((list) =>
      list.map((b, i) => (i === index ? ({ ...b, ...patch } as TemplateButtonInput) : b)),
    );
  }

  function handleFile(file: File) {
    if (!connectionId) {
      toast.error("Selecione a conta do WhatsApp primeiro");
      return;
    }
    setIsUploading(true);
    const fd = new FormData();
    fd.append("connectionId", connectionId);
    fd.append("file", file);
    startTransition(async () => {
      const result = await uploadTemplateHeaderAction(fd);
      setIsUploading(false);
      if (result.ok) {
        setHeaderHandle(result.data.handle);
        setHeaderFileName(file.name);
        toast.success("Arquivo enviado");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createTemplateAction({
        connectionId,
        name,
        language,
        category,
        headerType,
        headerText,
        headerHandle,
        bodyText,
        footerText,
        buttons,
        examples,
      });
      if (result.ok) {
        toast.success("Modelo enviado para revisão da Meta");
        router.push("/templates");
      } else {
        toast.error(result.error);
      }
    });
  }

  if (step === 1) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Categoria</CardTitle>
            <CardDescription>
              Escolha o tipo de modelo que melhor se encaixa na sua mensagem. A Meta cobra e
              limita cada categoria de um jeito.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {TEMPLATE_CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICON[c];
              const selected = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    selected
                      ? "border-brand bg-brand-soft"
                      : "border-line hover:border-line-3 bg-card",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card-2 text-ink-2">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      {CATEGORY_LABEL[c]}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-2">
                      {CATEGORY_DESCRIPTION[c]}
                    </span>
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/templates")}>
            Cancelar
          </Button>
          <Button onClick={() => setStep(2)}>Próximo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Modelo de {CATEGORY_LABEL[category].toLowerCase()}</CardTitle>
              <CardDescription>
                Modelos novos passam por revisão da Meta — normalmente até 24 horas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Nome</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                  }
                  placeholder="cobranca_mensal"
                />
                <p className="text-[11px] text-ink-3">
                  Só letras minúsculas, números e underscore.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-lang">Idioma</Label>
                <select
                  id="tpl-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-conn">Conta do WhatsApp</Label>
                <select
                  id="tpl-conn"
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conteúdo</CardTitle>
              <CardDescription>
                Cabeçalho e rodapé são opcionais; o corpo é obrigatório.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Cabeçalho</Label>
                <div className="flex flex-wrap gap-2">
                  {HEADER_OPTIONS.map((o) => {
                    const Icon = o.icon;
                    const selected = headerType === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setHeaderType(o.value);
                          setHeaderHandle("");
                          setHeaderFileName("");
                        }}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
                          selected
                            ? "border-brand bg-brand-soft text-brand-strong"
                            : "border-line-2 bg-card text-ink-2 hover:text-ink",
                        )}
                      >
                        <Icon className="size-3.5" /> {o.label}
                      </button>
                    );
                  })}
                </div>

                {headerType === "TEXT" && (
                  <div className="space-y-1">
                    <Input
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="Título do modelo"
                      maxLength={60}
                    />
                    <div className="flex justify-end">
                      <Counter value={headerText.length} max={60} />
                    </div>
                  </div>
                )}

                {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && (
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={MEDIA_ACCEPT[headerType]}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      {headerHandle ? "Trocar arquivo" : "Enviar arquivo"}
                    </Button>
                    <span className="truncate text-xs text-ink-3">
                      {headerFileName || "O arquivo vira o exemplo aprovado pela Meta."}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tpl-body">Corpo</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={insertVariable}>
                    <Plus className="size-3.5" /> Variável
                  </Button>
                </div>
                <textarea
                  id="tpl-body"
                  ref={bodyRef}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={6}
                  maxLength={1024}
                  placeholder="Olá {{1}}, seu boleto de {{2}} vence amanhã."
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                />
                <div className="flex justify-end">
                  <Counter value={bodyText.length} max={1024} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tpl-footer">Rodapé</Label>
                <Input
                  id="tpl-footer"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="Opcional"
                  maxLength={60}
                />
                <div className="flex justify-end">
                  <Counter value={footerText.length} max={60} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Botões</CardTitle>
              <CardDescription>
                Até 10 no total. Acima de 3, o WhatsApp mostra em forma de lista.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="size-3.5" /> Adicionar botão
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => addButton("QUICK_REPLY")}>
                    <Reply className="size-3.5" /> Resposta rápida
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addButton("URL")}>
                    <FileText className="size-3.5" /> Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addButton("PHONE_NUMBER")}>
                    <Phone className="size-3.5" /> Telefone
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {buttons.map((b, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2">
                  <span className="label-caps w-24 shrink-0">
                    {b.type === "QUICK_REPLY" ? "Resposta" : b.type === "URL" ? "Link" : "Telefone"}
                  </span>
                  <Input
                    value={b.text}
                    onChange={(e) => updateButton(i, { text: e.target.value })}
                    placeholder="Nome do botão"
                    maxLength={25}
                    className="min-w-[140px] flex-1"
                  />
                  {b.type === "URL" && (
                    <Input
                      value={b.url}
                      onChange={(e) => updateButton(i, { url: e.target.value })}
                      placeholder="https://..."
                      className="min-w-[180px] flex-1"
                    />
                  )}
                  {b.type === "PHONE_NUMBER" && (
                    <Input
                      value={b.phone_number}
                      onChange={(e) => updateButton(i, { phone_number: e.target.value })}
                      placeholder="+5511999999999"
                      className="min-w-[160px] flex-1"
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remover botão"
                    onClick={() => setButtons((list) => list.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {hasVariables && (
            <Card>
              <CardHeader>
                <CardTitle>Exemplos de variáveis</CardTitle>
                <CardDescription>
                  A Meta revisa o modelo com esses valores. Eles não vão pro cliente — no envio,
                  cada variável recebe o dado real do contato.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {headerPlaceholders.map((p) => (
                  <div key={`header:${p}`} className="flex flex-wrap items-center gap-2">
                    <code className="w-28 shrink-0 rounded bg-card-2 px-2 py-1 text-xs text-ink-2">
                      {`{{${p}}}`}
                    </code>
                    <span className="label-caps">cabeçalho</span>
                    <Input
                      value={examples[`header:${p}`] ?? ""}
                      onChange={(e) =>
                        setExamples((prev) => ({ ...prev, [`header:${p}`]: e.target.value }))
                      }
                      placeholder="Exemplo"
                      className="min-w-[180px] flex-1"
                    />
                  </div>
                ))}
                {bodyPlaceholders.map((p) => (
                  <div key={`body:${p}`} className="flex flex-wrap items-center gap-2">
                    <code className="w-28 shrink-0 rounded bg-card-2 px-2 py-1 text-xs text-ink-2">
                      {`{{${p}}}`}
                    </code>
                    <span className="label-caps">corpo</span>
                    <Input
                      value={examples[`body:${p}`] ?? ""}
                      onChange={(e) =>
                        setExamples((prev) => ({ ...prev, [`body:${p}`]: e.target.value }))
                      }
                      placeholder="Exemplo"
                      className="min-w-[180px] flex-1"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Prévia fixa: o mesmo aparelho que a transmissão usa, então o que a
            pessoa vê aqui é o que ela vai ver na hora de disparar. */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <WhatsAppPreview
            headerText={headerType === "TEXT" ? headerText : null}
            bodyText={bodyText}
            footerText={footerText}
            buttons={previewButtons}
            resolved={previewResolved}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep(1)}>
          <ChevronLeft className="size-4" /> Anterior
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-3">
            A edição não fica disponível enquanto a Meta revisa.
          </span>
          <Button onClick={handleSubmit} disabled={isPending || isUploading}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Enviar para revisão
          </Button>
        </div>
      </div>
    </div>
  );
}
