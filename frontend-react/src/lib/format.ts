import type { Biomarker } from "../types";

export function formatDate(value?: string): string {
  if (!value) return "Sem data";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(date).replace(" de ", " de ");
}

export function parseNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function findBiomarker(items: Biomarker[], name: string): Biomarker | undefined {
  const target = name.toLocaleUpperCase("pt-BR");
  return items.find(item => item.name.toLocaleUpperCase("pt-BR") === target)
    ?? items.find(item => item.name.toLocaleUpperCase("pt-BR").includes(target));
}

export function safeMarkdown(markdown?: string): string {
  if (!markdown) return "";
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  const lines = escaped.split(/\r?\n/);
  let html = "";
  let list: "ul" | "ol" | null = null;
  const close = () => { if (list) html += `</${list}>`; list = null; };
  for (const source of lines) {
    const line = source.trim();
    if (!line) { close(); continue; }
    if (line.startsWith("### ")) { close(); html += `<h3>${line.slice(4)}</h3>`; continue; }
    if (line.startsWith("## ")) { close(); html += `<h2>${line.slice(3)}</h2>`; continue; }
    if (line.startsWith("# ")) { close(); html += `<h1>${line.slice(2)}</h1>`; continue; }
    const unordered = /^[-*]\s+/.test(line);
    const ordered = /^\d+\.\s+/.test(line);
    if (unordered || ordered) {
      const next = unordered ? "ul" : "ol";
      if (list !== next) { close(); list = next; html += `<${next}>`; }
      html += `<li>${line.replace(unordered ? /^[-*]\s+/ : /^\d+\.\s+/, "")}</li>`;
      continue;
    }
    close();
    html += `<p>${line}</p>`;
  }
  close();
  return html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
