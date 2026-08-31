"use client";

import { useTransition } from "react";
import { PhoneCall } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { registerPhoneNumberAction } from "@/features/meta/actions";

type Props = { workspaceId: string; phoneNumberRowId: string };

// Fallback pra números que conectaram (Embedded Signup/Coexistência) mas
// nunca completaram o registro silencioso na Cloud API do lado da Meta —
// sem isso o envio falha com "The account is not registered".
export function RegisterPhoneNumberButton({ workspaceId, phoneNumberRowId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleRegister() {
    startTransition(async () => {
      const result = await registerPhoneNumberAction({ workspaceId, phoneNumberRowId });
      if (result.ok) {
        toast.success("Número registrado na Cloud API");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleRegister}>
      <PhoneCall className="size-3.5" />
      {isPending ? "Registrando..." : "Registrar"}
    </Button>
  );
}
