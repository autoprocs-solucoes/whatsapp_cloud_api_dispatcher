import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Rotas que exigem sessão. Cada página também se protege por conta própria
 * (`requireUser`/`requireActiveWorkspace`), mas barrar aqui evita renderizar e
 * consultar o banco à toa. `/api/webhooks/*` fica de fora de propósito: quem
 * chama é a Meta, sem cookie, e a autenticação ali é por assinatura. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/conversas",
  "/contatos",
  "/segmentos",
  "/templates",
  "/transmissao",
  "/configuracoes",
  "/perfil",
  "/master",
  "/onboarding",
  "/aceitar-convite",
];

const AUTH_ROUTES = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Perguntar quem é só serve pra decidir redirecionamento. Em rota que não é
  // nem protegida nem de login, a resposta ia pro lixo — e não era de graça:
  // `auth.getUser()` é uma chamada de rede ao Supabase, que daqui sai do
  // Brasil e vai a Ohio, antes de a página sequer começar a renderizar.
  if (!isProtected && !isAuthRoute) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
