// Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, CRLF).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Convert a row array + header map into a typed record.
export function csvToRecords<T extends Record<string, string>>(
  rows: string[][],
  columns: (keyof T)[]
): T[] {
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const out: T[] = [];
  for (let i = 1; i < rows.length; i++) {
    const rec = {} as T;
    columns.forEach((col, idx) => {
      const headerIdx = header.indexOf(String(col).toLowerCase());
      (rec as any)[col] = headerIdx >= 0 ? (rows[i][headerIdx] ?? "").trim() : "";
    });
    out.push(rec);
  }
  return out;
}
