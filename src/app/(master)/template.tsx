export default function MasterTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-in fade-in duration-300">{children}</div>;
}
