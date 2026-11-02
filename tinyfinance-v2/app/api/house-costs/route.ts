import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/lib/access";
import { route } from "@/lib/http";
import { houseCostSchema } from "@/lib/house-dashboard";
import { databaseError } from "@/lib/errors";
export const POST = route(async (req: NextRequest) => {
  const a = await getContext("write");
  const parsed = houseCostSchema.parse(await req.json());
  const { id, record_version, ...payload } = parsed;
  const { data: center, error: ce } = await a.client
    .from("cost_centers")
    .select("id")
    .eq("organization_id", a.org)
    .eq("id", payload.cost_center_id)
    .maybeSingle();
  if (ce) databaseError(ce);
  if (!center)
    return NextResponse.json(
      { error: "Kostenstelle nicht gefunden." },
      { status: 400 },
    );
  const query = id
    ? a.client
        .from("house_costs")
        .update({ ...payload, record_version })
        .eq("id", id)
        .eq("organization_id", a.org)
        .eq("record_version", record_version!)
    : a.client
        .from("house_costs")
        .insert({ ...payload, organization_id: a.org });
  const { data, error } = await query.select("*").maybeSingle();
  if (error) databaseError(error);
  if (!data)
    return NextResponse.json(
      { error: "Eintrag wurde zwischenzeitlich geändert. Bitte neu laden." },
      { status: 409 },
    );
  return NextResponse.json({ cost: data });
});
