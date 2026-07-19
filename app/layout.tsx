import "./globals.css";
import type { Metadata, Viewport } from "next";

const description = "Compare two Codex-built post-quantum migrations and inspect the deterministic evidence that selects—or refuses—a winner.";
export const metadata: Metadata = {
  metadataBase: new URL("https://quantum-twin.vercel.app"),
  title: "Quantum Twin — Evidence-backed PQC migration",
  description,
  openGraph: { title: "Quantum Twin — Evidence-backed PQC migration", description, type: "website", url: "/" },
  twitter: { card: "summary", title: "Quantum Twin — Evidence-backed PQC migration", description },
};
export const viewport: Viewport = { themeColor: "#f2efe6" };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
