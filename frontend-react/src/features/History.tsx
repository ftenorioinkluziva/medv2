import { EmptyState, SectionHeader } from "../components/common";
import { formatDate } from "../lib/format";
import type { Analysis, ClinicalDocument } from "../types";

export function History({ analyses, documents, onAnalysis }: { analyses: Analysis[]; documents: ClinicalDocument[]; onAnalysis: (id: string) => void }) {
  return <div className="page-stack"><SectionHeader title="Histórico Clínico" meta="Análises e documentos preservados como evidência" />
    <section className="content-card"><SectionHeader title="Análises" meta={`${analyses.length} disponíveis`} />{analyses.length ? <div className="history-list">{analyses.map(item => <button type="button" key={item.id} onClick={() => onAnalysis(item.id)}><div><strong>{formatDate(item.date)}</strong><span>{item.bloodTestFilename || "Exame de sangue"}</span></div><span>Carregar no Painel</span></button>)}</div> : <EmptyState title="Nenhuma análise disponível" />}</section>
    <section className="content-card"><SectionHeader title="Documentos" meta={`${documents.length} arquivados`} />{documents.length ? <div className="history-list documents">{documents.map(item => <a key={item.id} href={`/api/documents/${encodeURIComponent(item.id)}/file`} target="_blank" rel="noreferrer"><div><strong>{item.name}</strong><span>{formatDate(item.date)} · {item.type === "blood-test" ? "Exame de sangue" : "Bioimpedância"}</span></div><span>Ver PDF</span></a>)}</div> : <EmptyState title="Nenhum documento arquivado" />}</section>
  </div>;
}
