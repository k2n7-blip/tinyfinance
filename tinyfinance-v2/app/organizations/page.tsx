import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase";
import { AppError, databaseError } from "@/lib/errors";
import OrganizationWorkspace from "@/app/components/organization-workspace";
import Security from "@/app/components/security";
export const dynamic = "force-dynamic";
export default async function Organizations() {
  let session;
  try {
    session = await currentUser();
  } catch (e) {
    if (e instanceof AppError && e.status === 503) redirect("/setup");
    throw e;
  }
  if (!session.user) redirect("/login");
  const { data: members, error } = await session.client
    .from("memberships")
    .select("organization_id,role")
    .eq("user_id", session.user.id);
  if (error) databaseError(error);
  const { data: orgs, error: orgError } = await session.client
    .from("organizations")
    .select("id,name");
  if (orgError) databaseError(orgError);
  return (
    <main>
      <header className="page-header">
        <div>
          <span className="eyebrow">TinyFinance</span>
          <h1>Mandanten</h1>
          <p className="muted">
            Wähle den Arbeitsbereich. Finanzdaten bleiben getrennt.
          </p>
        </div>
        <a href="/settings">Sicherheit</a>
      </header>
      <OrganizationWorkspace
        organizations={(orgs || []).map((o) => ({
          ...o,
          role: members?.find((m) => m.organization_id === o.id)?.role,
        }))}
      />
      {!orgs?.length && <Security />}
    </main>
  );
}
