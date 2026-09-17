// template.tsx remonta a cada navegação (layout.tsx não) — é o jeito
// idiomático do App Router pra ter transição de página sem keyar nada à mão.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">{children}</div>;
}
