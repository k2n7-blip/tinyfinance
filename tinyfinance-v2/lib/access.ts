import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "./supabase";
import { AppError, databaseError } from "./errors";
import { permits, type Scope } from "./permissions";
export { permits, type Scope } from "./permissions";
export async function getContext(scope: Scope = "read") {
  const { client, user } = await currentUser();
  if (!user) throw new AppError(401, "Bitte anmelden.");
  const { data: memberships, error } = await client
    .from("memberships")
    .select("organization_id,role,private_access,payroll_access")
    .eq("user_id", user.id)
    .order("organization_id");
  if (error) databaseError(error);
  const orgCookie = (await cookies()).get("tf-organization")?.value;
  const membership =
    memberships?.find((m) => m.organization_id === orgCookie) ||
    (memberships?.length === 1 ? memberships[0] : null);
  if (!membership)
    throw new AppError(409, "Bitte einen Mandanten auswählen oder anlegen.");
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error)
    throw new AppError(
      401,
      "Die Sitzung konnte nicht geprüft werden. Bitte erneut anmelden.",
    );
  const needsMfa =
    membership.role === "owner" || assurance.data.nextLevel === "aal2";
  if (scope !== "session" && needsMfa && assurance.data.currentLevel !== "aal2")
    throw new AppError(
      428,
      "Bitte zuerst Zwei-Faktor-Anmeldung einrichten bzw. bestätigen.",
    );
  if (
    !permits(
      membership.role,
      scope,
      membership.private_access,
      membership.payroll_access,
    )
  )
    throw new AppError(403, "Kein Zugriff auf diesen Bereich.");
  return {
    client,
    user,
    org: membership.organization_id,
    role: membership.role,
    privateAccess: membership.private_access,
    payrollAccess: membership.payroll_access,
    mfaRequired: needsMfa && assurance.data.currentLevel !== "aal2",
  };
}
export async function pageContext(scope: Scope = "read") {
  try {
    return await getContext(scope);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.status === 401) redirect("/login");
    if (error.status === 503)
      redirect(
        error.reason === "database" ? "/setup?reason=database" : "/setup",
      );
    if (error.status === 409) redirect("/organizations");
    if (error.status === 428) redirect("/settings");
    redirect("/dashboard?denied=1");
  }
}
export async function context(edit = false) {
  return getContext(edit ? "write" : "read");
}
