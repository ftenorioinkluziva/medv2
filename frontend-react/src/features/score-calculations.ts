import { findBiomarker, parseNumber } from "../lib/format";
import type { Analysis, Profile } from "../types";

export interface SystemScore {
  key: string;
  title: string;
  subtitle: string;
  score: number;
  markers: string[];
}

const clamp = (value: number) => Math.max(10, Math.min(100, Math.round(value)));

export function calculateScores(analysis?: Analysis, profile?: Profile | null): SystemScore[] {
  const biomarkers = analysis?.biomarkers ?? [];
  const value = (name: string) => parseNumber(findBiomarker(biomarkers, name)?.value);

  let metabolic = 100;
  const imc = profile?.imc || 0;
  if (imc > 25) metabolic -= Math.min(30, (imc - 25) * 4);
  const homa = value("HOMA-IR");
  if (homa !== null) { if (homa > 1.9) metabolic -= 15; if (homa > 2.9) metabolic -= 15; }
  else if ((value("GLICOSE") ?? 0) > 99) metabolic -= 15;
  if ((value("TRIGLICERÍDEOS") ?? value("TRIGLICERIDEOS") ?? 0) > 150) metabolic -= 10;

  let cardio = 100;
  if ((value("COLESTEROL HDL") ?? 100) < 40) cardio -= 20;
  const ldl = value("COLESTEROL LDL");
  if ((ldl ?? 0) > 130) cardio -= 15;
  if ((ldl ?? 0) > 160) cardio -= 10;
  if ((profile?.cardioSistolica ?? 0) > 130) cardio -= 15;
  if ((profile?.cardioDiastolica ?? 0) > 85) cardio -= 10;

  let thyroid = 100;
  const tsh = value("TSH");
  const t4 = value("T4 LIVRE");
  if (tsh !== null) { if (tsh < 0.4 || tsh > 4.5) thyroid -= 20; else if (tsh > 2.5) thyroid -= 10; }
  if (t4 !== null && (t4 < 0.8 || t4 > 1.9)) thyroid -= 20;
  if (tsh === null && t4 === null) thyroid = 95;

  let inflammation = 100;
  const pcr = value("PROTEÍNA C REATIVA") ?? value("PROTEINA C REATIVA");
  if (pcr !== null) { if (pcr > 1) inflammation -= 15; if (pcr > 3) inflammation -= 15; }
  const ferritin = value("FERRITINA");
  if ((ferritin ?? 0) > 300) inflammation -= 15;
  if (ferritin !== null && ferritin < 30) inflammation -= 10;

  let hormones = 100;
  const testosterone = value("TESTOSTERONA TOTAL");
  if (testosterone !== null) { if (testosterone < 300) hormones -= 25; if (testosterone > 900) hormones -= 10; }
  if ((value("SHBG") ?? 100) < 15) hormones -= 15;
  if (testosterone === null && value("SHBG") === null) hormones = 95;

  let nutrition = 100;
  if ((value("VITAMINA D") ?? 100) < 30) nutrition -= 15;
  if ((value("VITAMINA B12") ?? 1000) < 300) nutrition -= 15;
  if (profile?.inbodyScore && profile.inbodyScore < 75) nutrition -= Math.min(20, (75 - profile.inbodyScore) * 1.5);

  return [
    { key: "metabolic", title: "Metabolismo & Glicemia", subtitle: "Sensibilidade à insulina, glicose e composição corporal", score: clamp(metabolic), markers: ["Glicose", "Insulina", "HOMA-IR", "Triglicerídeos"] },
    { key: "cardio", title: "Saúde Cardiovascular", subtitle: "Lipoproteínas, pressão arterial e risco aterogênico", score: clamp(cardio), markers: ["Colesterol Total", "Colesterol HDL", "Colesterol LDL", "Relação TG/HDL"] },
    { key: "thyroid", title: "Painel da Tireoide", subtitle: "Hormônios tireoidianos e metabolismo basal", score: clamp(thyroid), markers: ["TSH", "T4 Livre", "T3 Livre"] },
    { key: "inflammation", title: "Inflamação & Enzimas", subtitle: "Inflamação sistêmica e estresse celular", score: clamp(inflammation), markers: ["Proteína C Reativa", "Ferritina", "Razão de Ritis"] },
    { key: "hormones", title: "Hormônios & Vitalidade", subtitle: "Andrógenos e proteínas de ligação", score: clamp(hormones), markers: ["Testosterona Total", "SHBG", "Testosterona Livre", "LH", "FSH", "Estradiol"] },
    { key: "nutrition", title: "Nutrição & Estilo de Vida", subtitle: "Micronutrientes, sono e composição corporal", score: clamp(nutrition), markers: ["Vitamina D", "Vitamina B12", "Ferritina"] }
  ];
}
