import Link from "next/link";
import Navigation from "./navigation";
import { modules } from "@/lib/modules";
import { permits } from "@/lib/permissions";
export default function FinanceShell({
  children,
  title,
  subtitle,
  role,
  privateAccess = false,
  payrollAccess = false,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  role: string;
  privateAccess?: boolean;
  payrollAccess?: boolean;
}) {
  const visible = Object.entries(modules).filter(([, m]) =>
    permits(
      role,
      m.scope === "admin" ? "read" : m.scope,
      privateAccess,
      payrollAccess,
    ),
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">tf</span>
          <span>
            TinyFinance<small>Finanzen im Blick</small>
          </span>
        </Link>
        <Navigation>
          <nav aria-label="Hauptnavigation">
            <Link href="/dashboard">Übersicht</Link>
            <Link href="/documents">Belege</Link>
            <Link href="/ledger">Buchungsjournal</Link>
            <Link href="/bank">Bankabgleich</Link>
            <Link href="/reports">Auswertungen</Link><Link href="/search">Globale Suche</Link><Link href="/holidu">Holidu · Sammelbuchung</Link>{permits(role,"private",privateAccess,payrollAccess)&&<Link href="/rental">Excel-Jahre & Versorger</Link>}{permits(role,"payroll",privateAccess,payrollAccess)&&<Link href="/personnel">Personal & TinyTeam</Link>}
            {["Betrieb", "Buchhaltung", "Privat", "Personal"].map((group) => (
              <details key={group} open={group === "Betrieb"}>
                <summary>{group}</summary>
                {visible
                  .filter(([, m]) => m.group === group)
                  .map(([key, m]) => (
                    <Link key={key} href={"/finance/" + key}>
                      {m.title}
                    </Link>
                  ))}
              </details>
            ))}
          </nav>
        </Navigation>
        <div className="sidebar-footer">
          <Link href="/organizations">Mandant wechseln</Link>
          <Link href="/settings">⚙ Einstellungen</Link>
          <form action="/api/auth/logout" method="post">
            <button className="quiet">Abmelden</button>
          </form>
        </div>
      </aside>
      <main className="workspace">
        <header className="page-header">
          <div>
            <span className="eyebrow">Dein Finanzarbeitsplatz</span>
            <h1>{title}</h1>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <Link href="/search" className="settings-link">Suchen</Link>
          <Link
            className="settings-link"
            href="/settings"
            aria-label="Einstellungen"
          >
            ⚙
          </Link>
        </header>
        {children}
      </main>
    </div>
  );
}

