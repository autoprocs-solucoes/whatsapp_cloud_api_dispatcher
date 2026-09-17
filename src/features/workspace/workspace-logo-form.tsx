"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  removeWorkspaceLogoAction,
  updateWorkspaceLogoAction,
} from "@/features/workspace/actions";

type Props = {
  workspaceId: string;
  workspaceName: string;
  initialLogoUrl: string | null;
  canEdit: boolean;
};

/** Logo do cliente — é ela que aparece no topo do menu lateral. */
export function WorkspaceLogoForm({
  workspaceId,
  workspaceName,
  initialLogoUrl,
  canEdit,
}: Props) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const formData = new FormData();
    formData.append("workspaceId", workspaceId);
    formData.append("logo", file);
    startTransition(async () => {
      const res = await updateWorkspaceLogoAction(formData);
      URL.revokeObjectURL(localPreview);
      setPreview(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Logo atualizada");
    });
    e.target.value = "";
  }

  function handleRemove() {
    startTransition(async () => {
      const res = await removeWorkspaceLogoAction(workspaceId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLogoUrl(null);
      toast.success("Logo removida");
    });
  }

  const src = preview ?? logoUrl;

  return (
    <div className="flex items-center gap-4">
      {src ? (
        <Image
          src={src}
          alt=""
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-md border border-line bg-white object-contain p-1"
        />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-sm font-semibold text-ink-2">
          {workspaceName
            .split(/\s+/)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("")
            .slice(0, 2)}
        </span>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit || isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? "Enviando…" : "Trocar logo"}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!canEdit || isPending}
              onClick={handleRemove}
            >
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-3">
          {canEdit
            ? "PNG, JPEG ou WebP · até 5MB. Aparece no topo do menu lateral."
            : "Apenas owners podem trocar a logo."}
        </p>
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
