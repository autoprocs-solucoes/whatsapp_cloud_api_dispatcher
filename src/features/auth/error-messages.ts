/**
 * Traduz o que o Supabase devolve.
 *
 * As mensagens dele chegam em inglês e falando de implementação ("you can only
 * request this after 16 seconds"), o que deixa quem está tentando entrar sem
 * saber se errou algo ou se o sistema quebrou. Aqui vira português e, quando
 * dá, vira instrução.
 */

type Rule = { test: RegExp; message: string | ((match: RegExpMatchArray) => string) };

const RULES: Rule[] = [
  {
    // "For security purposes, you can only request this after 16 seconds."
    test: /only request this after (\d+) seconds?/i,
    message: (m) =>
      `Aguarde ${m[1]} segundos para pedir outro link. É um limite de segurança do provedor de e-mail.`,
  },
  {
    test: /email rate limit exceeded/i,
    message:
      "Muitos e-mails enviados em pouco tempo. Espere alguns minutos e tente de novo.",
  },
  {
    test: /over_email_send_rate_limit|rate limit/i,
    message: "Limite de envio atingido. Espere alguns minutos e tente de novo.",
  },
  {
    test: /user already registered|already been registered/i,
    message: "Já existe conta com esse e-mail. Use “Esqueci a senha” para entrar.",
  },
  {
    test: /invalid login credentials/i,
    message: "E-mail ou senha inválidos.",
  },
  {
    test: /email not confirmed/i,
    message:
      "Este e-mail ainda não foi confirmado. Abra o link que enviamos na caixa de entrada.",
  },
  {
    test: /password should be at least (\d+)/i,
    message: (m) => `A senha precisa ter pelo menos ${m[1]} caracteres.`,
  },
  {
    test: /unable to validate email address|invalid email/i,
    message: "E-mail inválido. Confira se não faltou alguma letra.",
  },
  {
    test: /token has expired|expired/i,
    message: "Este link expirou. Peça um novo.",
  },
];

export function translateAuthError(raw: string | null | undefined): string {
  const message = (raw ?? "").trim();
  if (!message) return "Não foi possível concluir. Tente de novo.";

  for (const rule of RULES) {
    const match = message.match(rule.test);
    if (match) {
      return typeof rule.message === "function" ? rule.message(match) : rule.message;
    }
  }

  return message;
}
