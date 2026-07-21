"use client";
import { useEffect, useState } from "react";

export default function RunnerStatus() {
  const [status, setStatus] = useState<{ ready: boolean; authenticated: boolean } | null | "error">(null);
  useEffect(() => { void fetch("/api/system").then(r => r.ok ? r.json() as Promise<{ ready: boolean; authenticated: boolean }> : Promise.reject()).then(setStatus).catch(() => setStatus("error")); }, []);
  const label = status === null ? "checking…" : status === "error" ? "unavailable" : status.ready ? "ready" : status.authenticated ? "auth only" : "not connected";
  const tone = status && status !== "error" ? (status.ready ? "ok" : status.authenticated ? "warn" : "off") : "off";
  return <div><dt>Runner</dt><dd className={`runner-${tone}`}>{label}</dd></div>;
}
