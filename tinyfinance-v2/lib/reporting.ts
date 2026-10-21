import { cents } from "./money";
import type { Row } from "./data";
export function ledgerReport(
  postings: Row[],
  allocations: Row[],
  accounts: Row[],
  documents: Row[],
  from: string,
  to: string,
) {
  const byCenter = new Map<string, { income: number; expense: number }>();
  const byAccount = new Map<string, { debit: number; credit: number }>();
  let income = 0,
    expense = 0,
    inputVat = 0,
    outputVat = 0;
  for (const p of postings.filter(
    (p) =>
      ["approved", "exported"].includes(p.status) &&
      p.posting_date >= from &&
      p.posting_date <= to,
  )) {
    const debit = accounts.find((a) => a.id === p.debit_account_id),
      credit = accounts.find((a) => a.id === p.credit_account_id);
    const amount = cents(p.amount);
    const incomeSign =
      (credit?.kind === "income" ? 1 : 0) - (debit?.kind === "income" ? 1 : 0);
    const expenseSign =
      (debit?.kind === "expense" ? 1 : 0) -
      (credit?.kind === "expense" ? 1 : 0);
    income += amount * incomeSign;
    expense += amount * expenseSign;
    const d = documents.find((d) => d.id === p.document_id);
    const vat = d?.vat_amount
      ? cents(d.vat_amount) * (p.reversal_of ? -1 : 1)
      : 0;
    if (d?.direction === "income") outputVat += vat;
    else inputVat += vat;
    const debitBalance = byAccount.get(p.debit_account_id) || {
      debit: 0,
      credit: 0,
    };
    debitBalance.debit += amount;
    byAccount.set(p.debit_account_id, debitBalance);
    const creditBalance = byAccount.get(p.credit_account_id) || {
      debit: 0,
      credit: 0,
    };
    creditBalance.credit += amount;
    byAccount.set(p.credit_account_id, creditBalance);
    for (const split of allocations.filter((a) => a.posting_id === p.id)) {
      const row = byCenter.get(split.cost_center_id) || {
        income: 0,
        expense: 0,
      };
      row.income += cents(split.amount) * incomeSign;
      row.expense += cents(split.amount) * expenseSign;
      byCenter.set(split.cost_center_id, row);
    }
  }
  return { income, expense, inputVat, outputVat, byCenter, byAccount };
}
export function openDocuments(
  documents: Row[],
  matches: Row[],
): (Row & { remaining: number })[] {
  return documents
    .filter((d) => d.review_status === "reviewed" && d.gross_amount !== null)
    .map((d) => ({
      ...d,
      remaining:
        cents(d.gross_amount) -
        matches
          .filter((m) => m.document_id === d.id && m.status === "confirmed")
          .reduce((s, m) => s + cents(m.amount), 0),
    }))
    .filter((d) => d.remaining > 0);
}
export function paidPreparation(
  documents: Row[],
  matches: Row[],
  transactions: Row[],
  from: string,
  to: string,
) {
  let income = 0,
    expense = 0;
  for (const match of matches.filter((m) => m.status === "confirmed")) {
    const txn = transactions.find((t) => t.id === match.bank_transaction_id);
    const doc = documents.find((d) => d.id === match.document_id);
    if (!txn || !doc || txn.booked_on < from || txn.booked_on > to) continue;
    if (doc.direction === "income") income += cents(match.amount);
    else expense += cents(match.amount);
  }
  return { income, expense };
}
