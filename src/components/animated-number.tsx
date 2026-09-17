"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  duration?: number;
  suffix?: string;
};

/** Count-up de números grandes em stat tiles. Pula direto pro valor final
 * quando o usuário prefere menos movimento — nunca é a única forma de ler o
 * número (o valor final sempre aparece). */
export function AnimatedNumber({ value, duration = 700, suffix = "" }: Props) {
  const [display, setDisplay] = useState(value);
  const prevValueRef = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setDisplay(value);
      prevValueRef.current = value;
      return;
    }

    const start = isFirstRender.current ? 0 : prevValueRef.current;
    isFirstRender.current = false;
    const startTime = performance.now();
    let raf: number;

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (value - start) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevValueRef.current = value;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  // Figuras proporcionais (não tabular-nums) — é o valor de um stat tile, não
  // uma coluna de tabela que precisa alinhar dígitos verticalmente.
  return (
    <span>
      {display.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
}
