export default function MasterTemplate({ children }: { children: React.ReactNode }) {
  return <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">{children}</div>;
}
