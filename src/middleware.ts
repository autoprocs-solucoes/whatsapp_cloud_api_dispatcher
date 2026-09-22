import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // `sw.js` e o manifest ficam de fora: o navegador busca os dois sem sessão,
  // e service worker servido atrás de redirect é recusado pela spec — a
  // instalação falharia calada, levando o push junto.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
