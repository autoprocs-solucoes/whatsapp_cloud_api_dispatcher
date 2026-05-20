"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NewContactDialog } from "@/features/contacts/new-contact-dialog";

export function NewContactButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="mr-1 size-4" /> Novo contato
      </Button>
      <NewContactDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
