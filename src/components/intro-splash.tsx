"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/** Quanto a abertura dura por inteiro, do primeiro balão ao fim do fade. */
const INTRO_MS = 2400;

const SEEN_KEY = "dispatcher:intro";

/**
 * Tela de abertura: os balões sobem, se fundem na marca, o nome revela por
 * corte e a tela sai.
 *
 * Aparece uma vez por sessão do navegador. Abertura bonita na primeira vez é
 * marca; na décima, é obstáculo entre a pessoa e o trabalho dela.
 *
 * A marcação vem no HTML do servidor, e não depois que o React monta: se ela
 * só entrasse na hidratação, a pessoa veria a aplicação por um instante e
 * *depois* a tela de abertura cobrindo o que já estava na frente dela.
 */
export function IntroSplash() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Navegador com armazenamento bloqueado: mostra e segue.
    }

    // Já tinha visto — o script inline já escondeu; aqui só tira do caminho.
    if (seen) {
      setDone(true);
      return;
    }

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

/**
 * Esconde a abertura antes da primeira pintura quando ela já rodou nesta
 * sessão.
 *
 * Roda no `<head>`, síncrono de propósito: esperar o React decidir significa
 * um lampejo de tela de abertura a cada recarga, que é pior do que não ter
 * abertura nenhuma.
 */
export const introSeenScript = `try{if(sessionStorage.getItem('${SEEN_KEY}')==='1')document.documentElement.classList.add('intro-seen')}catch(e){}`;
