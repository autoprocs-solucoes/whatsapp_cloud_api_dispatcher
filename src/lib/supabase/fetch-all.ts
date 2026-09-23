import "server-only";

/**
 * Tudo que a consulta devolve, não só a primeira página.
 *
 * O PostgREST corta qualquer select em 1000 linhas. Quem só chama `.select()`
 * recebe 1000 e nenhum aviso — a consulta "deu certo". Isso já fez uma
 * transmissão de 3.792 contatos sair com 1.000 destinatários, e estatística de
 * cliente grande parar de bater.
 *
 * `build` precisa montar a consulta do zero a cada página: o builder do
 * supabase-js é mutável e reaproveitá-lo entre páginas embaralha os filtros.
 *
 * A ordenação precisa ser estável — inclua sempre uma coluna única (o `id`)
 * como desempate, senão linhas com o mesmo `created_at` trocam de página e
 * algumas some. Um lote de importação cria milhares delas no mesmo instante.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];

  for (let page = 0; ; page++) {
    const from = page * pageSize;
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }

  return out;
}
