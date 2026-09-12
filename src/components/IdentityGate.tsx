"use client";

import { useEffect, useState } from "react";
import { IdentityContext } from "@/lib/IdentityContext";
import { clearIdentity, identityIdFromName, loadIdentity, ROLE_BLURB, ROLE_LABEL, ROLES, saveIdentity } from "@/lib/identity";
import type { Identity, Role } from "@/lib/types";

type MeResponse =
  | { mode: "lite" }
  | { mode: "auth0"; loggedIn: false }
  | { mode: "auth0"; loggedIn: true; needsRole: true; id: string; name: string }
  | { mode: "auth0"; loggedIn: true; needsRole: false; identity: Identity };

function RolePicker({
  title,
  subtitle,
  nameField,
  busy,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  nameField?: { value: string; onChange: (v: string) => void };
  busy: boolean;
  onSubmit: (role: Role) => void;
}) {
  const [role, setRole] = useState<Role | null>(null);
  return (
    <div className="grid min-h-dvh place-items-center bg-zinc-950 px-5 py-10 text-white">
      <div className="w-full max-w-sm">
        <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">SCAN</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>

        {nameField && (
          <input
            value={nameField.value}
            onChange={(e) => nameField.onChange(e.target.value)}
            placeholder="Your name"
            className="mt-6 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            autoFocus
          />
        )}

        <div className="mt-6 space-y-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                role === r
                  ? "border-emerald-400 bg-emerald-400/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <p className="font-medium">{ROLE_LABEL[r]}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{ROLE_BLURB[r]}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!role || busy || (nameField && !nameField.value.trim())}
          onClick={() => role && onSubmit(role)}
          className="mt-6 w-full rounded-full bg-emerald-400 py-3.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? "One sec…" : "Continue"}
        </button>
      </div>
    </div>
  );
}

export function IdentityGate({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | "loading">("loading");
  const [liteIdentity, setLiteIdentity] = useState<Identity | null>(null);
  const [liteName, setLiteName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/identity/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: MeResponse) => {
        setMe(data);
        if (data.mode === "lite") setLiteIdentity(loadIdentity());
      })
      .catch(() => setMe({ mode: "lite" }));
  }, []);

  if (me === "loading") return null;

  // Lite mode — no Auth0 configured. Name + role, saved to localStorage.
  if (me.mode === "lite") {
    if (!liteIdentity) {
      return (
        <RolePicker
          title="Who's scanning?"
          subtitle="One tap, no account — this just labels your scans and reviews."
          nameField={{ value: liteName, onChange: setLiteName }}
          busy={false}
          onSubmit={(role) => {
            const identity: Identity = { id: identityIdFromName(liteName), name: liteName.trim(), role };
            saveIdentity(identity);
            setLiteIdentity(identity);
          }}
        />
      );
    }
    return (
      <IdentityContext.Provider
        value={{
          identity: liteIdentity,
          authMode: "lite",
          switchIdentity: () => {
            clearIdentity();
            setLiteIdentity(null);
          },
        }}
      >
        {children}
      </IdentityContext.Provider>
    );
  }

  // Auth0 mode, not signed in.
  if (!me.loggedIn) {
    return (
      <div className="grid min-h-dvh place-items-center bg-zinc-950 px-5 text-center text-white">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">SCAN</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to continue</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-400">
            One account, one role — renter, landlord, or inspector — so the app only shows you what&apos;s yours.
          </p>
          <a
            href="/auth/login"
            className="mt-6 inline-block rounded-full bg-emerald-400 px-8 py-3.5 text-sm font-semibold text-black"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  // Auth0 mode, signed in, first time — pick a role once.
  if (me.needsRole) {
    return (
      <RolePicker
        title={`Hi, ${me.name.split(" ")[0]}`}
        subtitle="Pick the role that fits — you can't be all three at once, and that's the point."
        busy={busy}
        onSubmit={async (role) => {
          setBusy(true);
          try {
            await fetch("/api/identity/role", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role }),
            });
            setMe({ mode: "auth0", loggedIn: true, needsRole: false, identity: { id: me.id, name: me.name, role } });
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  return (
    <IdentityContext.Provider
      value={{
        identity: me.identity,
        authMode: "auth0",
        switchIdentity: () => {
          window.location.href = "/auth/logout";
        },
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}
