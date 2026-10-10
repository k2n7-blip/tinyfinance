import type { getDocumentProxy } from "unpdf";
type Pdf = Awaited<ReturnType<typeof getDocumentProxy>>;
// PDF content streams need not follow reading order. Reconstruct rows from positions,
// allowing superscript footnotes to stay next to their labels.
export async function orderedPdfText(document: Pdf) {
  if (document.numPages > 20) throw new Error("Too many pages");
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const content = await (await document.getPage(pageNumber)).getTextContent();
    const items = content.items.filter((item) => "str" in item);
    const rows: { y: number; items: typeof items }[] = [];
    for (const item of items.sort((a, b) => b.transform[5] - a.transform[5])) {
      let row = rows.find((r) => Math.abs(r.y - item.transform[5]) < 8);
      if (!row) {
        row = { y: item.transform[5], items: [] };
        rows.push(row);
      }
      row.items.push(item);
    }
    lines.push(
      ...rows.map((row) =>
        row.items
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map((item) => item.str)
          .join(" "),
      ),
    );
  }
  return lines.join("\n");
}
