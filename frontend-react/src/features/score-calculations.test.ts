import { describe, expect, it } from "vitest";
import { calculateScores } from "./score-calculations";
import type { Analysis, Profile } from "../types";

const profile = { imc: 31, cardioSistolica: 140, cardioDiastolica: 90, inbodyScore: 65 } as Profile;
const analysis = {
  biomarkers: [
    { name: "GLICOSE", value: 110, unit: "mg/dL", referenceRange: "", status: "alto" },
    { name: "HOMA-IR", value: 3.2, unit: "", referenceRange: "", status: "alto" },
    { name: "COLESTEROL HDL", value: 35, unit: "mg/dL", referenceRange: "", status: "baixo" },
    { name: "COLESTEROL LDL", value: 170, unit: "mg/dL", referenceRange: "", status: "alto" },
    { name: "VITAMINA D", value: 20, unit: "ng/mL", referenceRange: "", status: "baixo" }
  ]
} as Analysis;

describe("calculateScores", () => {
  it("returns the six bounded systems", () => {
    const scores = calculateScores(analysis, profile);
    expect(scores).toHaveLength(6);
    expect(scores.every(item => item.score >= 10 && item.score <= 100)).toBe(true);
  });

  it("reduces metabolic and cardiovascular scores when markers are altered", () => {
    const scores = calculateScores(analysis, profile);
    expect(scores.find(item => item.key === "metabolic")?.score).toBeLessThan(70);
    expect(scores.find(item => item.key === "cardio")?.score).toBeLessThan(70);
  });
});
