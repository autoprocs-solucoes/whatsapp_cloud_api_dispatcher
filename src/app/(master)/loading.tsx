import { Skeleton } from "@/components/ui/skeleton";

export default function MasterLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando…">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2 rounded-md border p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
