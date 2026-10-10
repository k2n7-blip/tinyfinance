import { NextRequest } from "next/server";
import { getContext } from "@/lib/access";
import { allRows } from "@/lib/data";
import { csvCell } from "@/lib/money";
import { route } from "@/lib/http";
export const GET = route(async (_req: NextRequest) => {
  const a = await getContext();
  const docs = await allRows(a.client, "documents", a.org);
  const fields = [
    "original_filename",
    "vendor",
    "invoice_number",
    "invoice_date",
    "service_date",
    "net_amount",
    "vat_amount",
    "gross_amount",
    "currency",
    "direction",
    "review_status",
  ] as const;
  const names = [
    "Original",
    "Lieferant / Kunde",
    "Rechnungsnummer",
    "Rechnungsdatum",
    "Leistungsdatum",
    "Netto",
    "Umsatzsteuer",
    "Brutto",
    "Währung",
    "Art",
    "Prüfstatus",
  ];
  const csv =
    "\uFEFF" +
    names.map(csvCell).join(";") +
    "\r\n" +
    docs.map((d) => fields.map((k) => csvCell(d[k])).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="tinyfinance-pruefliste.csv"',
    },
  });
});
