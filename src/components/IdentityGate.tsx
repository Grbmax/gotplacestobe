"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IdentityContext } from "@/lib/IdentityContext";
import { clearIdentity, identityIdFromName, loadIdentity, ROLE_BLURB, ROLE_LABEL, ROLES, saveIdentity } from "@/lib/identity";
import type { Identity, Role } from "@/lib/types";

const INTENDED_KEY = "scan.intendedPath";

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
  const nameEmpty = Boolean(nameField && !nameField.value.trim());
  const blocked = !role || busy || nameEmpty;
  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--bg)] px-5 py-10 text-[var(--fg)]">
      <div className="w-full max-w-sm">
        <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-700">SCAN</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>

        {nameField && (
          <input
            value={nameField.value}
            onChange={(e) => nameField.onChange(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="mt-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
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
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-medium">{ROLE_LABEL[r]}</p>
              <p className="mt-0.5 text-xs text-slate-500">{ROLE_BLURB[r]}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={blocked}
          aria-disabled={blocked}
          onClick={() => role && onSubmit(role)}
          className={`mt-6 w-full rounded-full bg-emerald-600 py-3.5 text-sm font-semibold text-white ${
            blocked ? "cursor-not-allowed opacity-40" : ""
          }`}
        >
          {busy ? "One sec…" : "Continue"}
        </button>
        {nameEmpty && (
          <p className="mt-2 text-center text-xs text-slate-500">Enter a name to continue</p>
        )}
        {!nameEmpty && !role && !busy && (
          <p className="mt-2 text-center text-xs text-slate-500">Pick a role to continue</p>
        )}
      </div>
    </div>
  );
}

function rememberIntended(pathname: string) {
  if (typeof window === "undefined") return;
  if (pathname && pathname !== "/") {
    try {
      sessionStorage.setItem(INTENDED_KEY, pathname + window.location.search);
    } catch {
      /* ignore */
    }
  }
}

function restoreIntended(router: ReturnType<typeof useRouter>) {
  if (typeof window === "undefined") return;
  try {
    const intended = sessionStorage.getItem(INTENDED_KEY);
    if (intended && intended !== window.location.pathname + window.location.search) {
      sessionStorage.removeItem(INTENDED_KEY);
      router.replace(intended);
    }
  } catch {
    /* ignore */
  }
}

export function IdentityGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | "loading">("loading");
  const [liteIdentity, setLiteIdentity] = useState<Identity | null>(null);
  const [liteName, setLiteName] = useState("Judge");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rememberIntended(pathname);
  }, [pathname]);

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
            restoreIntended(router);
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
      <div className="grid min-h-dvh place-items-center bg-[var(--bg)] px-5 text-center text-[var(--fg)]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-700">SCAN</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to continue</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
            One account, one role — renter, landlord, or inspector — so the app only shows you what&apos;s yours.
          </p>
          <a
            href="/auth/login"
            className="mt-6 inline-block rounded-full bg-emerald-600 px-8 py-3.5 text-sm font-semibold text-white"
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
            restoreIntended(router);
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
