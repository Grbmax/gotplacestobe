"use client";

import { createContext, useContext } from "react";
import type { Identity } from "./types";

type IdentityContextValue = {
  identity: Identity;
  authMode: "lite" | "auth0";
  switchIdentity: () => void;
};

export const IdentityContext = createContext<IdentityContextValue | null>(null);

/** Throws if used outside IdentityGate — every page in this app is wrapped by it via layout.tsx. */
export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used within IdentityGate");
  return ctx;
}
