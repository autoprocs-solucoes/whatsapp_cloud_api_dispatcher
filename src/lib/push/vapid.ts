/**
 * Chave pública VAPID.
 *
 * Fica embutida no código de propósito: chave pública de push é pública por
 * definição — todo navegador que se inscreve recebe ela. Guardar só na env
 * transforma um valor inofensivo num ponto de falha: basta o valor salvo no
 * painel carregar um caractere invisível pro `atob` quebrar com "characters
 * outside of the Latin1 range", derrubando a inscrição inteira sem mensagem
 * útil.
 *
 * A env continua tendo precedência, pra quem replicar o projeto com outro par
 * de chaves não precisar editar código.
 */

const BUILT_IN = "BDcXk1frDU81VSg06Z0Ih17SZzkjZxyFCOR5CFZKv4zBPxAiaOnsZf8rwBgA_DCwdG1mNwsSTc-h_zSsPncKSmg";

/** Tira o que não pertence ao base64url — inclusive espaço e zero-width. */
function clean(value: string | undefined | null): string {
  return (value ?? "").replace(/[^A-Za-z0-9-_]/g, "");
}

export function vapidPublicKey(): string {
  const fromEnv = clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  // Chave VAPID tem 87 caracteres; valor curto é env mal preenchida.
  return fromEnv.length >= 80 ? fromEnv : BUILT_IN;
}

export { clean as cleanVapidKey };
