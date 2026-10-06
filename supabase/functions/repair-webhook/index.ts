// =============================================================================
// repair-webhook — reinscreve o app da Autoprocs no webhook da Meta.
//
// Existe porque a correção precisa das credenciais da Meta, que vivem só na
// aplicação, e de alguém que possa chamá-la sem sessão de usuário. Esta função
// tem a service_role no próprio ambiente e faz a ponte.
//
// Chamada manualmente (`supabase functions invoke repair-webhook`) ou pelo
// cron, quando o webhook cair de novo.
// =============================================================================

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? Deno.env.get("NEXT_PUBLIC_APP_URL");

Deno.serve(async (req) => {
  if (!APP_URL) {
    return Response.json({ ok: false, error: "APP_URL não configurada" }, { status: 500 });
  }

  const base = APP_URL.replace(/\/+$/, "");
  // GET só olha; POST reinscreve. O padrão é olhar, pra chamada sem querer não
  // mexer em configuração de produção.
  const reparar = new URL(req.url).searchParams.get("reparar") === "1";

  const res = await fetch(`${base}/api/internal/webhook-repair`, {
    method: reparar ? "POST" : "GET",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });

  const texto = await res.text();
  return new Response(texto, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
