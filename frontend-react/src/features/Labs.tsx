import { useEffect, useMemo, useState } from "react";
import { EmptyState, SectionHeader } from "../components/common";
import { formatDate, parseNumber } from "../lib/format";
import type { Analysis, StructuredBiomarker } from "../types";

interface Preset { id: string; title: string; question: string; description: string; markers: string[] }
interface PresetGroup { title: string; presets: Preset[] }

const groups: PresetGroup[] = [
  { title: "Painéis Clínicos Principais", presets: [
    { id: "atherogenic", title: "Carga Aterogênica", question: "A carga de partículas aterogênicas está aumentando?", description: "Compara LDL, não-HDL, ApoB, triglicerídeos e Lp(a) ao longo das coletas.", markers: ["COLESTEROL LDL", "COLESTEROL NÃO HDL", "APOLIPOPROTEÍNA B", "TRIGLICERÍDEOS", "LIPOPROTEÍNA A"] },
    { id: "discordance", title: "Discordância LDL vs ApoB", question: "O colesterol transportado diverge do número de partículas?", description: "Coloca LDL, não-HDL e ApoB na mesma linha temporal.", markers: ["COLESTEROL LDL", "COLESTEROL NÃO HDL", "APOLIPOPROTEÍNA B"] },
    { id: "metabolic", title: "Síndrome Metabólica", question: "Há co-evolução entre lipídios, glicose e resistência à insulina?", description: "Acompanha o eixo glicêmico e a relação TG/HDL.", markers: ["TRIGLICERÍDEOS", "COLESTEROL HDL", "RELAÇÃO TG/HDL", "INSULINA", "HOMA-IR", "GLICOSE"] },
    { id: "glycemic", title: "Controle Glicêmico Ampliado", question: "O controle glicêmico agudo e crônico está consistente?", description: "Combina glicose, insulina, HOMA-IR e hemoglobina glicada.", markers: ["GLICOSE", "INSULINA", "HOMA-IR", "HEMOGLOBINA GLICADA", "GLICEMIA MÉDIA ESTIMADA"] },
    { id: "liver", title: "Fígado Metabólico", question: "Enzimas hepáticas acompanham alterações metabólicas?", description: "Observa ALT, AST, GGT e marcadores associados ao metabolismo.", markers: ["ALT (TGP)", "AST (TGO)", "GGT", "TRIGLICERÍDEOS", "INSULINA", "HOMA-IR"] },
    { id: "renal", title: "Função Renal", question: "A função renal permanece estável entre coletas?", description: "Acompanha creatinina, filtração estimada, ureia e potássio.", markers: ["CREATININA", "FILTRAÇÃO GLOMERULAR ESTIMADA", "UREIA", "POTÁSSIO"] },
    { id: "thyroid", title: "Tireoide Essencial", question: "TSH e T4 livre evoluem de forma coerente?", description: "Visão essencial do eixo tireoidiano.", markers: ["TSH", "T4 LIVRE"] }
  ]},
  { title: "Painéis Derivados e Co-fatores", presets: [
    { id: "fib4", title: "FIB-4 (Risco Hepático)", question: "O marcador derivado de fibrose hepática mudou?", description: "Relaciona idade, AST, ALT, plaquetas e FIB-4.", markers: ["IDADE", "AST (TGO)", "ALT (TGP)", "PLAQUETAS", "FIB-4"] },
    { id: "hematologic", title: "Inflamação Hematológica", question: "Há sinais hematológicos convergentes de inflamação?", description: "Observa PCR, leucócitos e razões NLR/PLR.", markers: ["PROTEÍNA C REATIVA", "LEUCÓCITOS", "SEGMENTADOS", "LINFÓCITOS", "RELAÇÃO NEUTRÓFILOS/LINFÓCITOS (NLR)", "PLAQUETAS"] },
    { id: "b12", title: "B12, Folato e Homocisteína", question: "Os cofatores de metilação e hematopoiese permanecem adequados?", description: "Cruza B12, folato, homocisteína e índices eritrocitários.", markers: ["VITAMINA B12", "ÁCIDO FÓLICO", "HOMOCISTEÍNA", "VCM", "RDW"] },
    { id: "iron", title: "Eritropoiese e Ferro", question: "O estoque e o uso de ferro acompanham a série vermelha?", description: "Compara ferritina, ferro e parâmetros do hemograma.", markers: ["FERRITINA", "FERRO SÉRICO", "HEMOGLOBINA", "HEMATÓCRITO", "VCM", "HCM", "RDW"] }
  ]},
  { title: "Painéis Hormonais", presets: [
    { id: "androgen", title: "Disponibilidade Androgênica", question: "A testosterona disponível acompanha SHBG e total?", description: "Compara testosterona total, livre e SHBG.", markers: ["TESTOSTERONA TOTAL", "SHBG", "TESTOSTERONA LIVRE"] },
    { id: "gonadal", title: "Eixo Gonadal Masculino", question: "Sinalização gonadal e produção hormonal estão coerentes?", description: "Relaciona testosterona, LH e FSH.", markers: ["TESTOSTERONA TOTAL", "TESTOSTERONA LIVRE", "LH", "FSH"] },
    { id: "adrenal", title: "Eixo Adrenal", question: "Os marcadores adrenais mudaram entre coletas?", description: "Acompanha cortisol e SDHEA.", markers: ["CORTISOL (08 HORAS)", "SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)"] },
    { id: "prostate", title: "Acompanhamento Próstata", question: "PSA total, livre e sua relação permanecem estáveis?", description: "Acompanha marcadores prostáticos na linha do tempo.", markers: ["PSA TOTAL", "PSA LIVRE", "RELAÇÃO PSA LIVRE/TOTAL"] }
  ]},
  { title: "Painéis de Micronutrientes", presets: [
    { id: "hematopoietic", title: "Hematopoiéticos", question: "Há carência de cofatores da síntese celular vermelha?", description: "Acompanha ferro, ferritina, B12, folato e série vermelha.", markers: ["VITAMINA B12", "ÁCIDO FÓLICO", "FERRO SÉRICO", "FERRITINA", "HEMOGLOBINA", "VCM", "RDW"] },
    { id: "minerals", title: "Minerais Metabólicos", question: "Cofatores enzimáticos e minerais permanecem adequados?", description: "Acompanha vitamina D, magnésio, zinco, cálcio e PTH.", markers: ["VITAMINA D", "MAGNÉSIO", "ZINCO SÉRICO", "CÁLCIO IÔNICO", "PARATORMÔNIO"] }
  ]}
];
const allPresets = groups.flatMap(group => group.presets);
const colors = ["oklch(0.72 0.18 55)", "oklch(0.72 0.12 245)", "oklch(0.72 0.17 145)", "oklch(0.68 0.14 315)", "oklch(0.78 0.16 78)"];

function EvolutionChart({ rows, analyses, markers }: { rows: StructuredBiomarker[]; analyses: Analysis[]; markers: string[] }) {
  const series = useMemo(() => {
    const dates = rows.length ? Array.from(new Set(rows.map(row => row.date))).sort() : analyses.map(item => item.date).sort();
    return markers.map(name => {
      const values = dates.map(date => {
        const structured = rows.find(row => row.date === date && row.biomarkerName.toUpperCase() === name.toUpperCase());
        if (structured) return structured.valueNumeric;
        const analysis = analyses.find(item => item.date === date);
        return parseNumber(analysis?.biomarkers.find(item => item.name.toUpperCase() === name.toUpperCase())?.value);
      });
      const baseline = values.find(value => value !== null) ?? null;
      return { name, dates, values, normalized: values.map(value => value === null || baseline === null || baseline === 0 ? null : ((value - baseline) / baseline) * 100) };
    }).filter(item => item.values.some(value => value !== null));
  }, [rows, analyses, markers]);
  if (!series.length) return <EmptyState title="Sem dados para este painel">Os marcadores selecionados ainda não aparecem nas análises disponíveis.</EmptyState>;
  const width = 720, height = 300, left = 48, right = 24, top = 28, bottom = 45;
  const points = series.flatMap(item => item.normalized.filter((value): value is number => value !== null));
  let min = Math.min(0, ...points), max = Math.max(0, ...points);
  if (max - min < 10) { min -= 5; max += 5; }
  const dates = series[0].dates;
  const x = (index: number) => dates.length === 1 ? width / 2 : left + ((width - left - right) * index / (dates.length - 1));
  const y = (value: number) => top + ((max - value) / (max - min)) * (height - top - bottom);
  return <div className="chart-shell"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução normalizada dos biomarcadores">
    {[0, 1, 2, 3, 4].map(index => { const value = max - ((max - min) * index / 4); return <g key={index}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="grid-line" /><text x={left - 8} y={y(value) + 4} textAnchor="end">{Math.round(value)}%</text></g>; })}
    {dates.map((date, index) => <text key={date} x={x(index)} y={height - 16} textAnchor="middle">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${date}T00:00:00`))}</text>)}
    {series.map((item, seriesIndex) => { const valid = item.normalized.map((value, index) => value === null ? null : `${x(index)},${y(value)}`).filter(Boolean).join(" "); return <g key={item.name}><polyline points={valid} fill="none" stroke={colors[seriesIndex % colors.length]} strokeWidth="2.5" strokeLinejoin="round" />{item.normalized.map((value, index) => value === null ? null : <circle key={index} cx={x(index)} cy={y(value)} r="4" fill="var(--surface)" stroke={colors[seriesIndex % colors.length]} strokeWidth="2"><title>{item.name}: {item.values[index]} em {formatDate(item.dates[index])}</title></circle>)}</g>; })}
  </svg><div className="chart-legend">{series.map((item, index) => <span key={item.name}><i style={{ background: colors[index % colors.length] }} />{item.name}</span>)}</div></div>;
}

export function Labs({ analyses, rows, activeAnalysis, onSaveAnnotations, saving }: { analyses: Analysis[]; rows: StructuredBiomarker[]; activeAnalysis?: Analysis; onSaveAnnotations: (value: string) => Promise<void>; saving: boolean }) {
  const [presetId, setPresetId] = useState(allPresets[0].id);
  const [tags, setTags] = useState<string[]>(() => { try { return JSON.parse(activeAnalysis?.annotations || "{}").tags || []; } catch { return []; } });
  const [details, setDetails] = useState(() => { try { return JSON.parse(activeAnalysis?.annotations || "{}").details || ""; } catch { return activeAnalysis?.annotations || ""; } });
  useEffect(() => {
    try {
      const annotation = JSON.parse(activeAnalysis?.annotations || "{}");
      setTags(Array.isArray(annotation.tags) ? annotation.tags : []);
      setDetails(typeof annotation.details === "string" ? annotation.details : "");
    } catch {
      setTags([]);
      setDetails(activeAnalysis?.annotations || "");
    }
  }, [activeAnalysis?.id, activeAnalysis?.annotations]);
  const preset = allPresets.find(item => item.id === presetId) ?? allPresets[0];
  const available = useMemo(() => Array.from(new Set(rows.map(row => row.biomarkerName).concat(analyses.flatMap(item => item.biomarkers.map(marker => marker.name))))).sort(), [rows, analyses]);
  const selected = preset.markers.map(marker => available.find(item => item.toUpperCase() === marker.toUpperCase())).filter((item): item is string => Boolean(item));
  const dates = rows.length ? Array.from(new Map(rows.map(row => [row.analysisId, row.date])).entries()) : analyses.map(item => [item.id, item.date] as const);
  const contextTags = ["Início de medicamento", "Perda de peso", "Infecção recente", "Exercício vigoroso", "Mudança alimentar"];
  if (!available.length) return <EmptyState title="Ainda não há biomarcadores históricos">Envie exames de sangue para construir a linha de evolução.</EmptyState>;
  return <div className="page-stack"><SectionHeader title="Labs" meta="Evolução histórica e co-evolução dos biomarcadores" />
    <section className="content-card"><SectionHeader title="Evolução de Biomarcadores" meta="Normalizado a partir da primeira medição disponível" /><div className="preset-layout"><div className="preset-selects">{groups.map(group => <label key={group.title}><span>{group.title}</span><select value={group.presets.some(item => item.id === presetId) ? presetId : ""} onChange={event => setPresetId(event.target.value)}><option value="" disabled>Escolha um painel</option>{group.presets.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>)}</div><aside className="preset-explanation"><span className="eyebrow">PERGUNTA CLÍNICA</span><h3>{preset.title}</h3><strong>{preset.question}</strong><p>{preset.description}</p><div className="marker-tags">{preset.markers.map(marker => <span key={marker} className={selected.includes(marker) ? "available" : ""}>{marker}</span>)}</div></aside></div><EvolutionChart rows={rows} analyses={analyses} markers={selected} /></section>
    <section className="content-card"><SectionHeader title="Contexto da coleta" meta={activeAnalysis ? formatDate(activeAnalysis.date) : "Selecione uma análise"} /><div className="tag-picker">{contextTags.map(tag => <label key={tag}><input type="checkbox" checked={tags.includes(tag)} onChange={event => setTags(event.target.checked ? [...tags, tag] : tags.filter(item => item !== tag))} />{tag}</label>)}</div><label className="field-wide">Horário e observações<input value={details} onChange={event => setDetails(event.target.value)} placeholder="Ex.: coleta às 07:45, jejum de 12 horas." /></label><div className="align-end"><button type="button" className="button primary" disabled={!activeAnalysis || saving} onClick={() => onSaveAnnotations(JSON.stringify({ tags, details }))}>{saving ? "Salvando..." : "Salvar contexto"}</button></div></section>
    <section className="content-card"><SectionHeader title="Histórico de todos os valores" meta={`${available.length} biomarcadores`} /><div className="table-scroll"><table><thead><tr><th>Biomarcador</th><th>Unidade</th>{dates.map(([id, date]) => <th key={id}>{formatDate(date)}</th>)}</tr></thead><tbody>{available.map(name => { const unit = rows.find(row => row.biomarkerName === name)?.unit ?? analyses.flatMap(item => item.biomarkers).find(item => item.name === name)?.unit ?? ""; return <tr key={name}><th>{name}</th><td>{unit}</td>{dates.map(([id]) => { const row = rows.find(item => item.analysisId === id && item.biomarkerName === name); const marker = analyses.find(item => item.id === id)?.biomarkers.find(item => item.name === name); const status = row?.status ?? marker?.status; return <td key={id}>{row || marker ? <span className={`value-cell ${status || "normal"}`}>{row?.valueText ?? marker?.value}</span> : "—"}</td>; })}</tr>; })}</tbody></table></div></section>
  </div>;
}
