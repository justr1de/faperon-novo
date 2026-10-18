"use client";

import { useEffect, useRef } from "react";

const SCRIPT_DO_GOOGLE = "https://accounts.google.com/gsi/client";

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (opcoes: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: "popup" }) => void;
      renderButton: (alvo: HTMLElement, opcoes: Record<string, string | number>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

/** Botão oficial do Google Identity Services (ADR 0035). O ID token vai à API, que confere a assinatura
 *  e só deixa entrar quem o administrador já cadastrou. */
export function EntrarComGoogle({ clienteId, aoReceber }: { clienteId: string; aoReceber: (credencial: string) => void }) {
  const alvo = useRef<HTMLDivElement>(null);
  const ultimo = useRef(aoReceber);
  ultimo.current = aoReceber;

  useEffect(() => {
    const desenhar = () => {
      if (!window.google || !alvo.current) return;
      window.google.accounts.id.initialize({
        client_id: clienteId,
        ux_mode: "popup",
        callback: (r) => {
          if (r.credential) ultimo.current(r.credential);
        },
      });
      window.google.accounts.id.renderButton(alvo.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        locale: "pt-BR",
        width: Math.min(alvo.current.offsetWidth || 320, 400),
      });
    };
    if (window.google) return desenhar();
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_DO_GOOGLE}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_DO_GOOGLE;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", desenhar);
    return () => script?.removeEventListener("load", desenhar);
  }, [clienteId]);

  // a altura reservada evita que o formulário pule quando o botão do Google aparece
  return <div ref={alvo} data-testid="entrar-com-google" className="flex min-h-11 justify-center" />;
}
