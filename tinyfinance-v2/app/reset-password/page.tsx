"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
export default function Reset() {
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [mode, setMode] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const s = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const r = mode
        ? await s.auth.updateUser({ password })
        : await s.auth.resetPasswordForEmail(email, {
            redirectTo:
              window.location.origin + "/auth/callback?next=/reset-password",
          });
      if (r.error) throw r.error;
      setMessage(
        mode
          ? "Passwort geändert. Du kannst dich anmelden."
          : "Falls das Konto existiert, erhältst du einen Wiederherstellungslink.",
      );
      setPassword("");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Wiederherstellung fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="panel auth-card">
        <h1>Passwort wiederherstellen</h1>
        {!configured && (
          <p className="warning">Die Supabase-Konfiguration fehlt.</p>
        )}
        <form className="stack" onSubmit={submit}>
          {mode ? (
            <label>
              Neues Passwort
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          ) : (
            <label>
              E-Mail
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          <button disabled={!configured || busy}>
            {mode ? "Neues Passwort speichern" : "Link anfordern"}
          </button>
        </form>
        <button className="quiet" onClick={() => setMode(!mode)}>
          {mode
            ? "Zurück zur Linkanforderung"
            : "Ich habe den Wiederherstellungslink geöffnet"}
        </button>
        <p role="status" className="feedback">
          {message}
        </p>
        <a href="/login">Zur Anmeldung</a>
      </section>
    </main>
  );
}
