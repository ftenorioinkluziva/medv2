import { describe, expect, it } from "vitest";
import { safeMarkdown } from "./format";

describe("safeMarkdown", () => {
  it("renders supported markdown while escaping embedded HTML", () => {
    const output = safeMarkdown("## Estado\n\n**Atenção** <script>alert('x')</script>");
    expect(output).toContain("<h2>Estado</h2>");
    expect(output).toContain("<strong>Atenção</strong>");
    expect(output).toContain("&lt;script&gt;");
    expect(output).not.toContain("<script>");
  });

  it("groups consecutive list items", () => {
    expect(safeMarkdown("- Um\n- Dois")).toBe("<ul><li>Um</li><li>Dois</li></ul>");
  });
});
