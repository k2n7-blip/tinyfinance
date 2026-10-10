"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { labels } from "@/lib/permissions";
type Row = Record<string, any>;
export default function AdminSettings({
  initial,
  members,
}: {
  initial: Row;
  members: Row[];
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial),
    [member, setMember] = useState({
      user_id: "",
      role: "advisor_read",
      private_access: false,
      payroll_access: false,
    }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function send(url: string, method: string, body: Row) {
    setBusy(true);
    try {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      if (x.row) setSettings(x.row);
      setMessage("Gespeichert.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Buchhaltung und Übergabe</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(
              "/api/settings",
              "PATCH",
              Object.fromEntries(
                [
                  "framework",
                  "advisor_number",
                  "client_number",
                  "fiscal_year_start",
                  "account_length",
                  "datev_test_import_confirmed",
                  "ai_enabled",
                  "record_version",
                ].map((k) => [k, settings[k]]),
              ),
            );
          }}
        >
          <div className="editgrid">
            <label>
              Kontenrahmen
              <select
                value={settings.framework}
                onChange={(e) =>
                  setSettings({ ...settings, framework: e.target.value })
                }
              >
                <option>SKR03</option>
                <option>SKR04</option>
              </select>
            </label>
            <label>
              Kontenlänge
              <input
                type="number"
                min="4"
                max="8"
                value={settings.account_length}
                onChange={(e) =>
                  setSettings({ ...settings, account_length: e.target.value })
                }
              />
            </label>
            <label>
              Beraternummer
              <input
                required
                pattern="[0-9]{4,7}"
                value={settings.advisor_number || ""}
                onChange={(e) =>
                  setSettings({ ...settings, advisor_number: e.target.value })
                }
              />
            </label>
            <label>
              Mandantennummer
              <input
                required
                pattern="[0-9]{1,5}"
                value={settings.client_number || ""}
                onChange={(e) =>
                  setSettings({ ...settings, client_number: e.target.value })
                }
              />
            </label>
            <label>
              Wirtschaftsjahr beginnt
              <input
                required
                type="date"
                value={settings.fiscal_year_start}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    fiscal_year_start: e.target.value,
                  })
                }
              />
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.datev_test_import_confirmed}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  datev_test_import_confirmed: e.target.checked,
                })
              }
            />
            Ein echter Testimport wurde durch den Steuerberater bestätigt
          </label>
          <p className="muted">
            Diese Bestätigung wird protokolliert. Ohne sie sind ausschließlich
            Testexporte möglich.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.ai_enabled}
              onChange={(e) =>
                setSettings({ ...settings, ai_enabled: e.target.checked })
              }
            />
            KI-Erkennung durch externen Anbieter für diesen Mandanten erlauben
          </label>
          <p className="muted">
            Originale werden bei einer Erkennung an den konfigurierten Anbieter
            übermittelt. API-Schlüssel ausschließlich serverseitig in den
            Umgebungseinstellungen hinterlegen.
          </p>
          <button disabled={busy}>Einstellungen speichern</button>
        </form>
      </section>
      <section className="panel">
        <h2>Rollen und Zugriffsbereiche</h2>
        <p>
          Neue Benutzer zuerst in Supabase Auth einladen. Übernimm anschließend
          ihre Auth-Benutzer-ID. Berater und Nur-Lesen erhalten keinen privaten
          oder Personalbereich.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Benutzer-ID</th>
                <th>Rolle</th>
                <th>Zusätzliche Bereiche</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.user_id}</td>
                  <td>{labels[m.role]}</td>
                  <td>
                    {[
                      m.private_access ? "Privat" : "",
                      m.payroll_access ? "Personal" : "",
                    ]
                      .filter(Boolean)
                      .join(", ") || "–"}
                  </td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() =>
                        setMember({
                          user_id: m.user_id,
                          role: m.role,
                          private_access: m.private_access,
                          payroll_access: m.payroll_access,
                        })
                      }
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="quiet"
                      disabled={busy}
                      onClick={() =>
                        send("/api/memberships", "DELETE", {
                          user_id: m.user_id,
                        })
                      }
                    >
                      Zugriff entziehen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(
              "/api/memberships",
              "POST",
              Object.fromEntries(
                ["user_id", "role", "private_access", "payroll_access"].map(
                  (k) => [k, (member as Row)[k]],
                ),
              ),
            );
          }}
        >
          <div className="editgrid">
            <label>
              Auth-Benutzer-ID
              <input
                required
                value={member.user_id}
                onChange={(e) =>
                  setMember({ ...member, user_id: e.target.value })
                }
              />
            </label>
            <label>
              Rolle
              <select
                value={member.role}
                onChange={(e) =>
                  setMember({
                    ...member,
                    role: e.target.value,
                    private_access: false,
                    payroll_access: false,
                  })
                }
              >
                {[
                  "owner",
                  "bookkeeper",
                  "advisor_read",
                  "advisor_review",
                  "viewer",
                ].map((role) => (
                  <option key={role} value={role}>
                    {labels[role]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {member.role === "bookkeeper" && (
            <div className="row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={member.private_access}
                  onChange={(e) =>
                    setMember({ ...member, private_access: e.target.checked })
                  }
                />
                Privatbereich zusätzlich erlauben
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={member.payroll_access}
                  onChange={(e) =>
                    setMember({ ...member, payroll_access: e.target.checked })
                  }
                />
                Personalbereich zusätzlich erlauben
              </label>
            </div>
          )}
          <button disabled={busy}>Berechtigungen speichern</button>
        </form>
      </section>
      <p className="feedback" role="status">
        {message}
      </p>
    </>
  );
}
