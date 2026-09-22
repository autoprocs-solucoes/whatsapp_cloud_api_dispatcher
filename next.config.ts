import type { NextConfig } from "next";

/**
 * Host do Supabase Storage. Fotos de perfil e logos de empresa são servidas de
 * lá (bucket público `avatars`), e o next/image recusa qualquer host que não
 * esteja declarado aqui — sem isso a imagem quebra silenciosamente.
 */
function supabaseHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const storageHost = supabaseHostname();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // "Comunicados" virou "Transmissão". Link antigo (favorito, e-mail de
  // notificação já enviado) continua chegando no lugar certo.
  async redirects() {
    return [
      { source: "/comunicados", destination: "/transmissao", permanent: true },
      { source: "/comunicados/novo", destination: "/transmissao/nova", permanent: true },
      { source: "/comunicados/:path*", destination: "/transmissao/:path*", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      // Curinga: vale para qualquer projeto Supabase hospedado, mesmo que a env
      // não esteja disponível no momento do build.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Domínio próprio / self-hosted, quando a env está presente no build.
      ...(storageHost && !storageHost.endsWith(".supabase.co")
        ? ([
            {
              protocol: "https" as const,
              hostname: storageHost,
              pathname: "/storage/v1/object/public/**",
            },
          ])
        : []),
    ],
  },
};

export default nextConfig;
