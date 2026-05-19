"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  analyzeImportAction,
  confirmImportAction,
  previewImportAction,
  type ImportAnalysis,
  type ImportStats,
  type PreviewImportResult,
} from "@/features/contacts/actions";

type Step = 1 | 2 | 3;

type CustomColumnConfig = {
  sourceHeader: string;
  fieldKey: string;
  enabled: boolean;
};

function slugifyKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function downloadCsv(filename: string, rows: { row: number; phone: string; reason: string }[]) {
  const header = "linha,telefone,motivo\n";
  const body = rows
    .map((r) => `${r.row},"${r.phone.replace(/"/g, '""')}","${r.reason}"`)
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ContactsImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewImportResult | null>(null);

  const [phoneColumn, setPhoneColumn] = useState<string>("");
  const [fullNameColumn, setFullNameColumn] = useState<string>("");
  const [customColumns, setCustomColumns] = useState<CustomColumnConfig[]>([]);

  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);

  function buildMappingFormData() {
    if (!file) return null;
    const mapping = {
      phoneColumn,
      fullNameColumn: fullNameColumn || null,
      customColumns: customColumns
        .filter((c) => c.enabled && c.fieldKey.trim())
        .map((c) => ({ sourceHeader: c.sourceHeader, fieldKey: c.fieldKey.trim() })),
    };
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapping", JSON.stringify(mapping));
    return fd;
  }

  function resetMapping(p: PreviewImportResult) {
    const phone = p.autoMapping.phoneColumn ?? "";
    const name = p.autoMapping.fullNameColumn ?? "";
    setPhoneColumn(phone);
    setFullNameColumn(name);
    setCustomColumns(
      p.headers
        .filter((h) => h !== phone && h !== name)
        .map((h) => ({
          sourceHeader: h,
          fieldKey: slugifyKey(h) || "campo",
          enabled: true,
        })),
    );
  }

  function handleFile(f: File) {
    setFile(f);
    setPreview(null);
    setStats(null);

    const fd = new FormData();
    fd.append("file", f);

    startTransition(async () => {
      const res = await previewImportAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        setFile(null);
        return;
      }
      setPreview(res.data);
      resetMapping(res.data);
    });
  }

  function handleConfirm() {
    const fd = buildMappingFormData();
    if (!fd) return;

    startTransition(async () => {
      const res = await confirmImportAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStats(res.data);
      toast.success(
        `Import concluído: ${res.data.valid_new} novos, ${res.data.valid_updated} atualizados.`,
      );
    });
  }

  useEffect(() => {
    if (step !== 3 || stats || !file || !phoneColumn) return;

    const fd = buildMappingFormData();
    if (!fd) return;

    let cancelled = false;
    setIsAnalyzing(true);
    setAnalysis(null);

    analyzeImportAction(fd)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          toast.error(res.error);
          setStep(2);
          return;
        }
        setAnalysis(res.data);
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const canAdvanceStep1 = preview !== null && !isPending;
  const canAdvanceStep2 = phoneColumn !== "" && !isPending;

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Selecione o arquivo</CardTitle>
            <CardDescription>
              Aceita .xlsx ou .csv. Primeira linha deve conter os nomes das colunas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-start gap-3">
              <Label htmlFor="file-input" className="sr-only">
                Arquivo
              </Label>
              <Input
                id="file-input"
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                disabled={isPending}
              />
              {file && (
                <p className="text-muted-foreground text-xs">
                  <FileUp className="mr-1 inline size-3" /> {file.name} (
                  {Math.round(file.size / 1024)} KB)
                </p>
              )}
              {isPending && (
                <p className="text-muted-foreground text-xs">
                  <Loader2 className="mr-1 inline size-3 animate-spin" /> Lendo arquivo…
                </p>
              )}
            </div>

            {preview && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  {preview.totalRows} linha(s) detectada(s) · {preview.headers.length} coluna(s) ·
                  exibindo primeiras {Math.min(10, preview.sampleRows.length)}:
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        {preview.headers.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row, i) => (
                        <tr key={i} className="border-t">
                          {preview.headers.map((h) => (
                            <td key={h} className="max-w-[200px] truncate px-2 py-1">
                              {row[h] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!canAdvanceStep1}
              >
                Próximo <ArrowRight className="ml-1 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && preview && (
        <Card>
          <CardHeader>
            <CardTitle>2. Mapeie as colunas</CardTitle>
            <CardDescription>
              Indique qual coluna contém o telefone (obrigatório) e quais campos custom importar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Coluna do telefone (obrigatório)</Label>
              <select
                value={phoneColumn}
                onChange={(e) => setPhoneColumn(e.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">— selecione —</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Coluna do nome completo (opcional)</Label>
              <select
                value={fullNameColumn}
                onChange={(e) => setFullNameColumn(e.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">— nenhum —</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Campos custom</Label>
              <p className="text-muted-foreground text-xs">
                Demais colunas viram campos custom. Desmarque o que não quiser importar.
              </p>
              <div className="space-y-2 rounded-md border p-3">
                {customColumns.length === 0 && (
                  <p className="text-muted-foreground text-xs">Nenhuma coluna extra.</p>
                )}
                {customColumns.map((c, i) => {
                  const isPhone = c.sourceHeader === phoneColumn;
                  const isName = c.sourceHeader === fullNameColumn;
                  if (isPhone || isName) return null;
                  return (
                    <div key={c.sourceHeader} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) => {
                          const copy = [...customColumns];
                          copy[i] = { ...c, enabled: e.target.checked };
                          setCustomColumns(copy);
                        }}
                        className="size-4"
                      />
                      <span className="text-muted-foreground w-40 truncate text-xs">
                        {c.sourceHeader}
                      </span>
                      <span className="text-muted-foreground text-xs">→</span>
                      <Input
                        value={c.fieldKey}
                        onChange={(e) => {
                          const copy = [...customColumns];
                          copy[i] = { ...c, fieldKey: slugifyKey(e.target.value) };
                          setCustomColumns(copy);
                        }}
                        disabled={!c.enabled}
                        className="h-7 text-xs"
                        placeholder="chave_do_campo"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 size-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canAdvanceStep2}>
                Próximo <ArrowRight className="ml-1 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && preview && (
        <Card>
          <CardHeader>
            <CardTitle>3. Revisar e confirmar</CardTitle>
            <CardDescription>
              Veja exatamente quem será criado e quem será atualizado antes de gravar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!stats ? (
              <>
                <div className="rounded-md border p-4 text-sm">
                  <p className="text-muted-foreground text-xs">
                    Telefone: <code>{phoneColumn}</code>
                    {fullNameColumn && (
                      <>
                        {" "}
                        · Nome: <code>{fullNameColumn}</code>
                      </>
                    )}{" "}
                    · {customColumns.filter((c) => c.enabled).length} campo(s) custom
                  </p>
                </div>

                {isAnalyzing && (
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" /> Analisando arquivo…
                  </div>
                )}

                {analysis && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <StatCard label="Total" value={analysis.total} />
                      <StatCard label="Novos" value={analysis.valid_new} accent="primary" />
                      <StatCard
                        label="Atualizados"
                        value={analysis.valid_updated}
                        accent="secondary"
                      />
                      <StatCard
                        label="Inválidos"
                        value={analysis.invalid}
                        accent="destructive"
                      />
                    </div>
                    {analysis.duplicates_in_file > 0 && (
                      <p className="text-muted-foreground text-xs">
                        {analysis.duplicates_in_file} duplicado(s) dentro do arquivo (será mantida
                        só a primeira ocorrência).
                      </p>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <PreviewList
                        title="Serão criados"
                        emptyMessage="Nenhum contato novo."
                        total={analysis.valid_new}
                        sample={analysis.new_sample}
                      />
                      <PreviewList
                        title="Serão atualizados"
                        emptyMessage="Nenhum contato existente será atualizado."
                        total={analysis.valid_updated}
                        sample={analysis.updated_sample}
                      />
                    </div>

                    {analysis.invalid_rows.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadCsv("contatos_invalidos.csv", analysis.invalid_rows)
                        }
                      >
                        <Download className="mr-1 size-4" /> Baixar CSV de inválidos (
                        {analysis.invalid_rows.length})
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="mr-1 size-4" /> Voltar
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={
                      isPending ||
                      isAnalyzing ||
                      !analysis ||
                      analysis.valid_new + analysis.valid_updated === 0
                    }
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-1 size-4 animate-spin" /> Importando…
                      </>
                    ) : (
                      <>
                        <Upload className="mr-1 size-4" /> Confirmar import
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Total" value={stats.total} />
                  <StatCard label="Novos" value={stats.valid_new} accent="primary" />
                  <StatCard label="Atualizados" value={stats.valid_updated} accent="secondary" />
                  <StatCard label="Inválidos" value={stats.invalid} accent="destructive" />
                </div>
                {stats.duplicates_in_file > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {stats.duplicates_in_file} duplicado(s) dentro do próprio arquivo (mantida só
                    primeira ocorrência).
                  </p>
                )}
                {stats.invalid_rows.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadCsv("contatos_invalidos.csv", stats.invalid_rows)
                    }
                  >
                    <Download className="mr-1 size-4" /> Baixar CSV de inválidos (
                    {stats.invalid_rows.length})
                  </Button>
                )}
                <Separator />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => router.push("/contatos")}>
                    Ver contatos <Check className="ml-1 size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Mapear" },
    { n: 3, label: "Confirmar" },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-7 items-center justify-center rounded-full border text-xs font-medium",
              step >= it.n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground",
            )}
          >
            {step > it.n ? <Check className="size-3.5" /> : it.n}
          </div>
          <span
            className={cn(
              "text-sm",
              step >= it.n ? "font-medium" : "text-muted-foreground",
            )}
          >
            {it.label}
          </span>
          {i < items.length - 1 && <div className="bg-input mx-1 h-px w-8" />}
        </div>
      ))}
    </div>
  );
}

function PreviewList({
  title,
  emptyMessage,
  total,
  sample,
}: {
  title: string;
  emptyMessage: string;
  total: number;
  sample: { row: number; phone_e164: string; full_name: string | null }[];
}) {
  const remaining = total - sample.length;
  return (
    <div className="rounded-md border">
      <div className="border-b px-3 py-2">
        <p className="text-sm font-medium">
          {title} <span className="text-muted-foreground">({total})</span>
        </p>
      </div>
      {total === 0 ? (
        <p className="text-muted-foreground p-3 text-xs">{emptyMessage}</p>
      ) : (
        <>
          <ul className="max-h-64 divide-y overflow-y-auto text-xs">
            {sample.map((r) => (
              <li key={`${r.row}-${r.phone_e164}`} className="flex justify-between gap-2 px-3 py-1.5">
                <span className="truncate">{r.full_name || <span className="text-muted-foreground italic">sem nome</span>}</span>
                <span className="text-muted-foreground font-mono">{r.phone_e164}</span>
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p className="text-muted-foreground border-t px-3 py-1.5 text-xs">
              + {remaining} adicional(is) não exibido(s)
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "secondary" | "destructive";
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          accent === "primary" && "text-primary",
          accent === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
      {accent === "secondary" && <Badge variant="secondary" className="mt-1 text-[10px]">UPSERT</Badge>}
    </div>
  );
}
