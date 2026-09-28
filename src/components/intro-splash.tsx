"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/** Quanto a abertura dura por inteiro, do primeiro balão ao fim do fade. */
const INTRO_MS = 2400;

/**
 * Tela de abertura: os balões sobem, se fundem na marca, o nome revela por
 * corte e a tela sai.
 *
 * Roda a cada carregamento de página. Navegar dentro da aplicação não
 * recarrega nada, então ela aparece quando se entra no Dispatcher e quando se
 * atualiza a tela — não a cada clique no menu.
 *
 * A marcação vem no HTML do servidor, e não depois que o React monta: se ela
 * só entrasse na hidratação, a pessoa veria a aplicação por um instante e
 * *depois* a tela de abertura cobrindo o que já estava na frente dela.
 */
export function IntroSplash() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDone(true), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Sai do DOM quando acaba: overlay em tela cheia que fica pra trás, mesmo
  // invisível, é o tipo de coisa que come clique num navegador qualquer.
  if (done) return null;

  return (
    <div className="intro" aria-hidden="true">
      <div className="intro-stage">
        <div className="intro-bubbles">
          {/* Dois elementos por balão: o de fora converge, o de dentro sobe.
              Juntas no mesmo elemento, uma anula a outra. */}
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="intro-bubble">
              <span className="intro-dot" />
            </span>
          ))}
        </div>

        <div className="intro-lockup">
          <Image
            src="/autoprocs-logo.png"
            alt=""
            width={44}
            height={44}
            priority
            className="intro-mark size-11"
          />
          <span className="intro-name">Dispatcher</span>
        </div>
      </div>
    </div>
  );
}
