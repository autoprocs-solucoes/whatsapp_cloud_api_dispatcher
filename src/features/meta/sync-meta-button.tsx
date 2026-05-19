"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncMetaConnectionAction } from "@/features/meta/actions";

type Props = { workspaceId: string };

export function SyncMetaButton({ workspaceId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      const result = await syncMetaConnectionAction({ workspaceId });
      if (result.ok) {
        toast.success("Status sincronizado com a Meta");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button variant="outline" disabled={isPending} onClick={handleSync}>
      <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Sincronizando..." : "Sincronizar"}
    </Button>
  );
}
