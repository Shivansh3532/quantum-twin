import "./globals.css";
import type { Metadata, Viewport } from "next";

const title = "Quantum Twin — Upgrade old cryptography safely";
const description = "Quantum Twin finds RSA signatures in your Node.js code, plans a move to NIST-standardized ML-DSA, builds two independent migrations with Codex, tests both, and gives you the verified result to review.";
export const metadata: Metadata = {
  metadataBase: new URL("https://quantum-twin.vercel.app"),
  title,
  description,
  openGraph: { title, description, type: "website", url: "/" },
  twitter: { card: "summary", title, description },
};
export const viewport: Viewport = { themeColor: "#f2efe6" };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
