import type { Metadata, Viewport } from "next";
import { IdentityGate } from "@/components/IdentityGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "SCAN",
  description:
    "Move-in damage assessment: photograph a rental, flag mold and damage, and pull Allegheny County housing inspection records.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <IdentityGate>{children}</IdentityGate>
      </body>
    </html>
  );
}
