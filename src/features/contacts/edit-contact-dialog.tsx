"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
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
import { updateContactAction } from "@/features/contacts/actions";
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

  useEffect(() => {
    if (!contact) return;
    setFullName(contact.full_name ?? "");
    setTags(contact.tags ?? []);
    setTagInput("");
    setNewKey("");
    const cf = (contact.custom_fields ?? {}) as Record<string, string>;
    setCustomFields(Object.entries(cf).map(([key, value]) => ({ key, value: String(value) })));
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
