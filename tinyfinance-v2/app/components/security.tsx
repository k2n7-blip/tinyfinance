"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
export default function Security() {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [factor, setFactor] = useState<{
      id: string;
      qr_code?: string;
      secret?: string;
    } | null>(null),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  async function startMfa() {
    setBusy(true);
    try {
      const s = supabase();
      const existing = await s.auth.mfa.listFactors();
      if (existing.error) throw existing.error;
      const verified = existing.data.totp.find((f) => f.status === "verified");
      if (verified) {
        setFactor({ id: verified.id });
        setMessage("Bitte den aktuellen Authenticator-Code eingeben.");
        return;
      }
      // Remove only this user's unfinished enrollments before creating a new one.
      for (const pending of existing.data.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        const r = await s.auth.mfa.unenroll({ factorId: pending.id });
        if (r.error) throw r.error;
      }
      const r = await s.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "TinyFinance",
      });
      if (r.error) throw r.error;
      setFactor({
        id: r.data.id,
        qr_code: r.data.totp.qr_code,
        secret: r.data.totp.secret,
      });
      setMessage("QR-Code scannen und Aktivierung mit einem Code bestätigen.");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Authenticator konnte nicht eingerichtet werden.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirmMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!factor) return;
    setBusy(true);
    try {
      const s = supabase();
      const c = await s.auth.mfa.challenge({ factorId: factor.id });
      if (c.error) throw c.error;
      const v = await s.auth.mfa.verify({
        factorId: factor.id,
        challengeId: c.data.id,
        code,
      });
      if (v.error) throw v.error;
      setFactor(null);
      setCode("");
      setMessage("Zwei-Faktor-Anmeldung bestätigt.");
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Code konnte nicht bestätigt werden.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await supabase().auth.updateUser({ password });
      if (r.error) throw r.error;
      setPassword("");
      setMessage("Passwort geändert.");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Passwort konnte nicht geändert werden.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Sicherheit</h2>
      <p>
        Für Administratoren ist eine bestätigte Zwei-Faktor-Anmeldung vor jedem
        Zugriff auf Finanzdaten erforderlich. Bewahre den Einrichtungsschlüssel
        sicher auf.
      </p>
      <button disabled={busy} type="button" onClick={startMfa}>
        Authenticator einrichten / Sitzung bestätigen
      </button>
      {factor && (
        <form className="stack mfa-form" onSubmit={confirmMfa}>
          {factor.qr_code && (
            <>
              <img
                alt="Authenticator QR-Code"
                src={factor.qr_code}
                width={190}
                height={190}
              />
              <details>
                <summary>Alternativer Einrichtungsschlüssel</summary>
                <code>{factor.secret}</code>
              </details>
            </>
          )}
          <label>
            Sechsstelliger Code
            <input
              required
              pattern="[0-9]{6}"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button disabled={busy}>Code bestätigen</button>
        </form>
      )}
      <h3>Passwort ändern</h3>
      <form onSubmit={updatePassword} className="row">
        <label>
          Neues Passwort
          <input
            type="password"
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button disabled={busy}>Passwort speichern</button>
      </form>
      <p className="feedback" role="status">
        {message}
      </p>
    </section>
  );
}
