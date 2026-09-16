"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { removeAvatarAction, updateAvatarAction } from "@/features/profile/actions";

type Props = {
  initialAvatarUrl: string | null;
  fullName: string;
  email: string;
};

function initials(name: string): string {
  const safe = name.trim() || "U";
  return safe
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

export function AvatarUploadForm({ initialAvatarUrl, fullName, email }: Props) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const formData = new FormData();
    formData.append("avatar", file);
    startTransition(async () => {
      const res = await updateAvatarAction(formData);
      URL.revokeObjectURL(localPreview);
      setPreview(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAvatarUrl(res.data.avatarUrl);
      toast.success("Foto de perfil atualizada");
    });
    e.target.value = "";
  }

  function handleRemove() {
    startTransition(async () => {
      const res = await removeAvatarAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAvatarUrl(null);
      toast.success("Foto removida");
    });
  }

  const displaySrc = preview ?? avatarUrl ?? undefined;

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg" className="size-16">
        {displaySrc && <AvatarImage src={displaySrc} alt={fullName || email} />}
        <AvatarFallback className="bg-primary/10 text-primary text-base font-medium">
          {initials(fullName || email)}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? "Enviando..." : "Trocar foto"}
          </Button>
          {avatarUrl && (
            <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={handleRemove}>
              Remover
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">PNG, JPEG ou WebP · até 5MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
