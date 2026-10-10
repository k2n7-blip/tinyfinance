import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, databaseError } from "./errors";
export type Row = Record<string, any>;
export async function allRows(
  client: SupabaseClient,
  table: string,
  org: string,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 0; page < 100; page++) {
    let query = client
      .from(table)
      .select(
        table === "export_batches"
          ? "id,organization_id,created_at,starts_on,ends_on,posting_ids,file_sha256,kind,actor_id"
          : "*",
      )
      .eq("organization_id", org)
      .order(table === "posting_allocations" ? "posting_id" : "id");
    if (table === "posting_allocations") query = query.order("cost_center_id");
    const { data, error } = await query.range(page * 500, page * 500 + 499);
    if (error) databaseError(error);
    rows.push(...(data || []));
    if ((data?.length || 0) < 500) return rows;
  }
  throw new AppError(
    413,
    "Diese Auswertung umfasst zu viele Datensätze. Bitte einen Zeitraum eingrenzen.",
  );
}
