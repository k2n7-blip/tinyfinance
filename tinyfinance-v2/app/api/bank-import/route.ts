import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import iconv from "iconv-lite";
import { getContext } from "@/lib/access";
import { parseBank } from "@/lib/imports";
import { AppError, databaseError } from "@/lib/errors";
import { route } from "@/lib/http";
export const POST = route(async (req: NextRequest) => {
  const a = await getContext("write");
  if (Number(req.headers.get("content-length") || 0) > 2_500_000)
    throw new AppError(413, "Datei zu groß.");
  const form = await req.formData();
  const account = z.string().uuid().parse(form.get("bank_account_id"));
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 2_000_000)
    throw new AppError(400, "CSV, CAMT.053 oder MT940 bis 2 MB erforderlich.");
  const { data: bank, error: bankError } = await a.client
    .from("bank_accounts")
    .select("*")
    .eq("id", account)
    .eq("organization_id", a.org)
    .eq("active", true)
    .single();
  if (bankError || !bank) throw new AppError(403, "Konto nicht verfügbar.");
  const bytes = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = iconv.decode(bytes, "windows-1252");
  }
  const rows = parseBank(text, file.name, bank.currency, bank.iban_last4);
  const { data, error } = await a.client.rpc("import_bank", {
    org: a.org,
    account,
    filename: file.name,
    file_hash: createHash("sha256").update(bytes).digest("hex"),
    rows,
  });
  if (error) databaseError(error);
  return NextResponse.json(data);
});
