"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { lastHouse, rememberHouse, onHouseChange } from "@/lib/activeHouse";

type Tab = "houses" | "scan" | "report" | "proof";

function tabFromPath(pathname: string): Tab | null {
  if (pathname.startsWith("/inspect")) return null;
  if (pathname.startsWith("/scan")) return "scan";
  if (pathname.startsWith("/report")) return "report";
  if (pathname.startsWith("/optimize")) return "proof";
  if (pathname === "/") return "houses";
  return "houses";
}

function houseFromPath(pathname: string, search: string) {
  const report = pathname.match(/^\/report\/([^/]+)/);
  if (report?.[1]) return report[1];
  const proof = pathname.match(/^\/optimize\/([^/]+)/);
  if (proof?.[1]) return proof[1];
  const q = new URLSearchParams(search).get("propertyId");
  return q;
}

function IconHouses({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" className={on ? "fill-current/20" : ""} />
    </svg>
  );
}

function IconScan({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={on ? "2.2" : "1.8"} aria-hidden>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" className={on ? "fill-current" : ""} />
    </svg>
  );
}

function IconReport({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 3.5h7.5L20 9v11.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" className={on ? "fill-current/20" : ""} />
      <path d="M14.5 3.5V9H20M8.5 13h7M8.5 16.5h5" />
    </svg>
  );
}

function IconProof({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 16.5 9 11l3.5 3.5L20 7" strokeLinejoin="round" />
      <path d="M4 20h16" className={on ? "" : "opacity-70"} />
    </svg>
  );
}

function BottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [houseId, setHouseId] = useState<string | null>(null);
  const active = tabFromPath(pathname);

  useEffect(() => {
    const sync = () => {
      const fromUrl = houseFromPath(pathname, searchParams.toString());
      if (fromUrl) rememberHouse(fromUrl);
      setHouseId(fromUrl ?? lastHouse());
    };
    sync();
    return onHouseChange(sync);
  }, [pathname, searchParams]);

  if (!active) return null;

  const scanHref = "/scan";
  const reportHref = "/report";
  const proofHref = "/optimize";

  const item = (tab: Tab, href: string, label: string, icon: ReactNode, opts?: { primary?: boolean; muted?: boolean }) => {
    const on = active === tab;
    const primary = opts?.primary;
    return (
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        aria-label={
          tab === "proof" ? "Proof — guided versus naive capture" : tab === "report" ? "Report — pick a house" : label
        }
        className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-medium tracking-wide ${
          primary
            ? on
              ? "-mt-4 text-emerald-800"
              : "-mt-4 text-slate-600"
            : on
              ? "text-emerald-700"
              : opts?.muted
                ? "text-slate-400"
                : "text-slate-500"
        }`}
      >
        <span
          className={
            primary
              ? `grid h-14 w-14 place-items-center rounded-full shadow-lg ${
                  on ? "bg-emerald-600 text-white" : "bg-white ring-1 ring-slate-300 text-slate-700"
                }`
              : "grid h-6 w-6 place-items-center"
          }
        >
          {icon}
        </span>
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="print:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur"
    >
      <div className="mx-auto flex max-w-md items-end px-2">
        {item("houses", "/", "Houses", <IconHouses on={active === "houses"} />)}
        {item("scan", scanHref, "Scan", <IconScan on={active === "scan"} />, { primary: true })}
        {item("report", reportHref, "Report", <IconReport on={active === "report"} />)}
        {item("proof", proofHref, "Proof", <IconProof on={active === "proof"} />)}
      </div>
    </nav>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}
