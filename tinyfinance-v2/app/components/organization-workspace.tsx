"use client";
import { useState } from "react";
import { labels } from "@/lib/permissions";
export default function OrganizationWorkspace({
  organizations,
}: {
  organizations: Record<string, any>[];
}) {
  const [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function send(payload: Record<string, any>) {
    setBusy(true);
    try {
      const r = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      window.location.href = "/dashboard";
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Mandant nicht verfügbar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="cards">
        {organizations.map((o) => (
          <section className="card" key={o.id}>
            <h2>{o.name}</h2>
            <p>{labels[o.role] || o.role}</p>
            <button disabled={busy} onClick={() => send({ id: o.id })}>
              Mandant öffnen
            </button>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Neuen Mandanten anlegen</h2>
        <p>
          Eine bestätigte Zwei-Faktor-Anmeldung ist erforderlich. Die fünf
          gewünschten Kostenstellen werden angelegt. Es werden keine Finanzdaten
          erfunden.
        </p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            send({ name });
          }}
        >
          <label>
            Bezeichnung
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button disabled={busy}>Mandant anlegen</button>
        </form>
        <p className="feedback" role="status">
          {message}
        </p>
      </section>
    </>
  );
}
