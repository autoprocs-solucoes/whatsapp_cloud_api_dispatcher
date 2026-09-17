import { Skeleton } from "@/components/ui/skeleton";

// Skeleton genérico do grupo (app): cabeçalho + linha de tiles + dois blocos.
// Aparece enquanto o server component da página busca dados (ex.: chamadas
// à Graph API em templates/configurações), em vez de tela em branco.
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando…">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
