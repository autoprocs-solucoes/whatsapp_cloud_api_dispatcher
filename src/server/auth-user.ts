import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * O usuário autenticado desta requisição, consultado uma vez só.
 *
 * `auth.getUser()` não lê um cookie: é uma chamada de rede ao Supabase, que
 * daqui fica em Ohio. O projeto chamava isso em mais de vinte lugares, e uma
 * única tela chegava a repetir a mesma pergunta seis ou sete vezes — layout,
 * página e cada server action, todos perguntando "quem é?" de novo. Era
 * meio segundo de espera por clique, gasto em perguntas já respondidas.
 *
 * `cache` do React guarda a resposta pelo tempo da requisição. Requisição nova,
 * pergunta nova — então nada de sessão velha sobrevivendo entre navegações.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});
