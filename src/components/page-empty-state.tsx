import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  epic: string;
};

export function PageEmptyState({ icon: Icon, title, description, epic }: Props) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-foreground text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">Implementação prevista: {epic}</p>
      </CardContent>
    </Card>
  );
}
