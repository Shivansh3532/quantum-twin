import Link from "next/link";

export const REPO_URL = "https://github.com/Shivansh3532/quantum-twin";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/demo", label: "Demo" },
  { href: "/support", label: "Supported" },
  { href: REPO_URL, label: "Repository" },
];

export function Brand() {
  return <Link className="brand" href="/" aria-label="Quantum Twin home"><span aria-hidden="true">QT</span><strong>Quantum <i>Twin</i></strong></Link>;
}

export function Nav({ current }: { current?: string }) {
  return <header className="topbar"><Brand/>
    <nav aria-label="Primary">{LINKS.map(link => {
      const external = link.href.startsWith("http");
      const active = current && link.href === current;
      return external
        ? <a key={link.href} href={link.href} rel="noreferrer">{link.label}</a>
        : <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>{link.label}</Link>;
    })}</nav>
  </header>;
}

export function SiteFooter() {
  return <footer><strong>Quantum Twin</strong><span>Find RSA. Plan the upgrade. Build twice. Prove it. Review the winner.</span><a href={REPO_URL} rel="noreferrer">Repository</a></footer>;
}
