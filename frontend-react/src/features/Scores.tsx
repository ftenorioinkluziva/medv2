import { EmptyState, SectionHeader } from "../components/common";
import { calculateScores } from "./score-calculations";
import { findBiomarker } from "../lib/format";
import type { Analysis, Profile } from "../types";

export function Scores({ analysis, profile }: { analysis?: Analysis; profile: Profile | null }) {
  if (!analysis) return <EmptyState title="Nenhuma análise disponível">Envie um exame para calcular os sistemas de saúde.</EmptyState>;
  const systems = calculateScores(analysis, profile);
  return <div className="page-stack"><SectionHeader title="Sistemas de Saúde" meta="Composição dos marcadores que sustentam cada pontuação" />{systems.map(system => <article className="system-panel" key={system.key}><header><div><h2>{system.title}</h2><p>{system.subtitle}</p></div><strong>{system.score}<small>/100</small></strong></header><div className="score-track" aria-label={`Pontuação ${system.score} de 100`}><span style={{ width: `${system.score}%` }} /></div><div className="table-scroll"><table><thead><tr><th>Marcador</th><th>Valor</th><th>Referência</th></tr></thead><tbody>{system.markers.map(name => { const marker = findBiomarker(analysis.biomarkers, name); return <tr key={name}><th>{name}</th><td>{marker ? <span className={`value-cell ${marker.status || "normal"}`}>{marker.value} {marker.unit}</span> : "—"}</td><td>{marker?.referenceRange || "—"}</td></tr>; })}</tbody></table></div></article>)}</div>;
}
