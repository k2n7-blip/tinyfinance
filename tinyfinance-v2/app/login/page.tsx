"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import Link from "next/link";
export default function Login() {
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [mfa, setMfa] = useState<string | null>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false);
  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const s = client();
      const { error } = await s.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const level = await s.auth.mfa.getAuthenticatorAssuranceLevel();
      if (level.error) throw level.error;
      if (
        level.data.nextLevel === "aal2" &&
        level.data.currentLevel !== "aal2"
      ) {
        const factors = await s.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        const factor = factors.data.totp.find((f) => f.status === "verified");
        if (!factor) throw Error("Authenticator nicht verfügbar.");
        setMfa(factor.id);
        return;
      }
      window.location.href = "/dashboard";
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!mfa) return;
    setBusy(true);
    try {
      const s = client();
      const challenge = await s.auth.mfa.challenge({ factorId: mfa });
      if (challenge.error) throw challenge.error;
      const r = await s.auth.mfa.verify({
        factorId: mfa,
        challengeId: challenge.data.id,
        code,
      });
      if (r.error) throw r.error;
      window.location.href = "/dashboard";
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Code ungültig.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <div className="auth-intro">
        <span className="brand-mark">tf</span>
        <span className="eyebrow">Dein Finanzarbeitsplatz</span>
        <h1>TinyFinance</h1>
        <p>
          Belege, Buchhaltung und Vermögen.
          <br />
          Klar organisiert und sicher getrennt.
        </p>
      </div>
      <section className="panel auth-card">
        <h2>Geschützter Zugang</h2>
        <p className="muted">Melde dich mit deinem persönlichen Konto an.</p>
        {!configured && (
          <p className="warning">
            Die Supabase-Konfiguration fehlt.{" "}
            <Link href="/setup">Einrichtung anzeigen</Link>
          </p>
        )}
        {!mfa ? (
          <form className="stack" onSubmit={login}>
            <label>
              E-Mail
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Passwort
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button disabled={!configured || busy} aria-busy={busy}>
              {busy ? "Anmeldung wird geprüft …" : "Anmelden"}
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={verify}>
            <h3>Zwei-Faktor-Anmeldung</h3>
            <label>
              Authenticator-Code
              <input
                pattern="[0-9]{6}"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
            <button disabled={busy} aria-busy={busy}>
              {busy ? "Code wird geprüft …" : "Code bestätigen"}
            </button>
          </form>
        )}
        <p className="feedback" role="status">
          {message}
        </p>
        <Link href="/reset-password">Passwort vergessen?</Link>
        <p className="muted">
          Konten werden durch die Administration eingeladen. Keine öffentliche
          Registrierung.
        </p>
      </section>
    </main>
  );
}
