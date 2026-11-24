type Cell = string | number | null | undefined;
export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Cell[][],
) {
  if (!rows.length) return;
  const quote = (value: Cell) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^\s*[=+\-@]/.test(text))
      text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  downloadFile(
    filename,
    `\uFEFF${[headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n")}`,
    "text/csv;charset=utf-8",
  );
}
