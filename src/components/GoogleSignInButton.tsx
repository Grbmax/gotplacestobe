"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            el: HTMLElement,
            opts: { theme: string; size: string; text: string; width: number; shape: string },
          ) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({ clientId }: { clientId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId || !host.current) return;

    let cancelled = false;

    const mount = () => {
      if (cancelled || !host.current || !window.google?.accounts?.id) return;
      host.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/identity/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential }),
            });
            if (!res.ok) throw new Error("Sign-in failed");
            window.location.reload();
          } catch {
            setError("Google sign-in didn’t go through. Try again.");
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(host.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: 320,
        shape: "pill",
      });
    };

    if (window.google?.accounts?.id) {
      mount();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-google-gsi]");
    if (existing) {
      existing.addEventListener("load", mount);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", mount);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "1";
    script.addEventListener("load", mount);
    script.addEventListener("error", () => setError("Couldn’t load Google sign-in."));
    document.head.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={host} className={busy ? "pointer-events-none opacity-50" : ""} />
      {busy && <p className="text-xs text-slate-500">Signing you in…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
