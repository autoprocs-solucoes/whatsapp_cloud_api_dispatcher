"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  approvePendingUpdateAction,
  listPendingUpdatesAction,
  rejectPendingUpdateAction,
  updateContactAction,
} from "@/features/contacts/actions";
import {
  parseCustomFields,
  type PendingUpdateItem,
} from "@/features/contacts/custom-fields";
import type { Contact } from "@/lib/supabase/database.types";

type Props = {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CustomField = { key: string; value: string };

export function EditContactDialog({ contact, open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newKey, setNewKey] = useState("");
  const [pending, setPending] = useState<PendingUpdateItem[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  useEffect(() => {
    if (!contact) {
      setPending([]);
      return;
    }
    setFullName(contact.full_name ?? "");
    setTags(contact.tags ?? []);
    setTagInput("");
    setNewKey("");
    const cf = parseCustomFields(contact.custom_fields);
    setCustomFields(Object.entries(cf).map(([key, value]) => ({ key, value })));
    setPending([]);
    let alive = true;
    listPendingUpdatesAction(contact.id).then((res) => {
      if (!alive) return;
      if (res.ok) setPending(res.data);
    });
    return () => {
      alive = false;
    };
  }, [contact]);

  if (!contact) return null;

  function handleAddTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  }

  function handleAddField() {
    const k = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!k || customFields.find((f) => f.key === k)) return;
    setCustomFields([...customFields, { key: k, value: "" }]);
    setNewKey("");
  }

  function handleApprovePending(item: PendingUpdateItem) {
    if (!contact) return;
    const fd = new FormData();
    fd.append("contact_id", contact.id);
    fd.append("pending_id", item.id);
    setDecidingId(item.id);
    startTransition(async () => {
      const res = await approvePendingUpdateAction(fd);
      setDecidingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Campo ${item.field} atualizado`);
      setPending((prev) => prev.filter((p) => p.id !== item.id));
      setCustomFields((prev) => {
        const idx = prev.findIndex((f) => f.key === item.field);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { key: item.field, value: item.value };
          return copy;
        }
        return [...prev, { key: item.field, value: item.value }];
      });
    });
  }

  function handleRejectPending(item: PendingUpdateItem) {
    if (!contact) return;
    const fd = new FormData();
    fd.append("contact_id", contact.id);
    fd.append("pending_id", item.id);
    setDecidingId(item.id);
    startTransition(async () => {
      const res = await rejectPendingUpdateAction(fd);
      setDecidingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Solicitação rejeitada");
      setPending((prev) => prev.filter((p) => p.id !== item.id));
    });
  }

  function handleSave() {
    if (!contact) return;
    const cfObj: Record<string, string> = {};
    customFields.forEach((f) => {
      if (f.key.trim()) cfObj[f.key.trim()] = f.value;
    });

    const fd = new FormData();
    fd.append("id", contact.id);
    fd.append("full_name", fullName);
    fd.append("custom_fields", JSON.stringify(cfObj));
    fd.append("tags", JSON.stringify(tags));

    startTransition(async () => {
      const res = await updateContactAction(null, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Contato atualizado");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Editar contato</SheetTitle>
          <SheetDescription>
            <code className="text-xs">{contact.phone_e164}</code>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="ml-1"
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="nova tag"
                className="h-8 text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          {pending.length > 0 && (
            <div className="space-y-2 rounded-md border border-amber-300/40 bg-amber-50/40 p-3 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <Label>Solicitações pendentes</Label>
                <Badge variant="outline" className="text-[10px]">
                  {pending.length}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                Atualizações propostas por fluxo externo. Aprovar grava em campos custom.
              </p>
              <div className="space-y-2">
                {pending.map((item) => {
                  const cf = parseCustomFields(contact.custom_fields);
                  const currentValue = cf[item.field];
                  const isUpdate = currentValue !== undefined;
                  const busy = decidingId === item.id;
                  return (
                    <div key={item.id} className="bg-background space-y-1 rounded border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs">{item.field}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {isUpdate ? "atualizar" : "novo"}
                        </Badge>
                      </div>
                      {isUpdate && (
                        <div className="text-muted-foreground text-xs">
                          atual: <span className="font-mono">{currentValue || "—"}</span>
                        </div>
                      )}
                      <div className="text-xs">
                        proposto: <span className="font-mono">{item.value}</span>
                      </div>
                      <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                        <span>{item.source ?? "externo"}</span>
                        <span>{new Date(item.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex justify-end gap-1 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy || isPending}
                          onClick={() => handleRejectPending(item)}
                        >
                          <X className="size-3.5" />
                          Rejeitar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy || isPending}
                          onClick={() => handleApprovePending(item)}
                        >
                          <Check className="size-3.5" />
                          Aprovar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Campos custom</Label>
            <div className="space-y-2">
              {customFields.map((f, i) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28 truncate text-xs">{f.key}</span>
                  <Input
                    value={f.value}
                    onChange={(e) => {
                      const copy = [...customFields];
                      copy[i] = { ...f, value: e.target.value };
                      setCustomFields(copy);
                    }}
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomFields(customFields.filter((_, j) => j !== i))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="nova_chave"
                  className="h-8 text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddField}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
