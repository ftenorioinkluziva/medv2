import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { EmptyState, Markdown, SectionHeader, StatusBadge } from "../components/common";
import { calculateScores } from "./score-calculations";
import { WorkoutChecklist } from "./WorkoutChecklist";
import { formatDate } from "../lib/format";
import type { Analysis, ClinicalDocument, DetailTab, Profile, Settings, Weekday } from "../types";

const detailTabs: Array<[DetailTab, string]> = [["status", "Estado"], ["insights", "Insights"], ["supplements", "Suplementos"], ["nutrition", "Nutrição"], ["training", "Treino"]];
const weekdays: Weekday[] = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const shortDay: Record<Weekday, string> = { "Segunda-feira": "Seg", "Terça-feira": "Ter", "Quarta-feira": "Qua", "Quinta-feira": "Qui", "Sexta-feira": "Sex", "Sábado": "Sáb", "Domingo": "Dom" };

function AnalysisDetail({ analysis, activeTab, onTab }: { analysis: Analysis; activeTab: DetailTab; onTab: (tab: DetailTab) => void }) {
  const [day, setDay] = useState<Weekday>(weekdays[(new Date().getDay() + 6) % 7]);
  const nutrition = analysis.nutritionPlan?.[day];

  return <section className="analysis-detail" aria-labelledby="detail-title">
    <header className="analysis-detail-heading"><div><span className="eyebrow">ANÁLISE DETALHADA</span><h2 id="detail-title">Estado, atenção e próximos passos</h2></div><span className="data-label">{formatDate(analysis.date)}</span></header>
    <div className="detail-tabs" role="tablist" aria-label="Seções da análise">{detailTabs.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} key={id} onClick={() => onTab(id)}>{label}</button>)}</div>
    <div className="detail-panel" role="tabpanel">
      {activeTab === "status" ? <article className="content-card"><SectionHeader title="Estado de Saúde Geral (Análise de IA)" meta={`Exame de referência: ${analysis.bloodTestFilename || "Laudo enviado"}`} /><Markdown>{analysis.healthStatus}</Markdown><p className="medical-note">Conteúdo informativo. Não substitui avaliação, diagnóstico ou prescrição profissional.</p></article> : null}
      {activeTab === "insights" ? <div className="alerts-list">{analysis.deterministicAlerts.length ? analysis.deterministicAlerts.map((alert, index) => <article className={`alert-row ${alert.severity}`} key={`${alert.biomarker}-${index}`}><header><div><strong>{alert.biomarker}</strong><span>{alert.source || "Clínica"}</span></div><StatusBadge status={alert.severity === "danger" ? "alterado" : alert.severity === "warning" ? "alto" : "normal"} /></header><dl><div><dt>Valor obtido</dt><dd>{String(alert.value)} {alert.unit}</dd></div><div><dt>Alvo ideal</dt><dd>{alert.optimalRange}</dd></div></dl><Markdown>{`**Interpretação:** ${alert.insight}\n\n**Orientação:** ${alert.protocol}`}</Markdown></article>) : <EmptyState title="Nenhum desvio crítico identificado">Os marcadores avaliados não geraram alertas determinísticos nesta análise.</EmptyState>}</div> : null}
      {activeTab === "supplements" ? <div>{analysis.supplementation.length ? <div className="supplement-list">{analysis.supplementation.map(item => <article key={`${item.name}-${item.dose}`}><div><h3>{item.name}</h3><p>{item.purpose}</p></div><dl><div><dt>Dose</dt><dd>{item.dose}</dd></div><div><dt>Frequência</dt><dd>{item.frequency}</dd></div></dl></article>)}</div> : <EmptyState title="Nenhum suplemento prescrito">Esta análise não contém um plano de suplementação.</EmptyState>}<p className="medical-note">Consulte seu médico antes de iniciar qualquer suplementação.</p></div> : null}
      {activeTab === "nutrition" || activeTab === "training" ? <div className="plan-detail">
          {(activeTab === "nutrition" ? analysis.nutritionOrientation : analysis.trainingOrientation) ? <details className="orientation">
            <summary><span className="eyebrow">ORIENTAÇÃO GERAL</span><span>Ver orientação completa</span></summary>
            <Markdown>{activeTab === "nutrition" ? analysis.nutritionOrientation : analysis.trainingOrientation}</Markdown>
          </details> : null}
         <div className="day-tabs" role="tablist" aria-label="Dia da semana">{weekdays.map(item => <button type="button" key={item} className={day === item ? "active" : ""} aria-selected={day === item} onClick={() => setDay(item)}>{shortDay[item]}</button>)}</div>
         {activeTab === "nutrition" ? Array.isArray(nutrition) ? nutrition.length ? <div className="meal-list">{nutrition.map((meal, index) => <article key={`${meal.time}-${index}`}><time>{meal.time}</time><div><h3>{meal.name}</h3><p>{meal.description}</p><span>{meal.proteinGrams}g proteína · {meal.carbsGrams}g carboidrato · {meal.fatGrams}g gordura</span></div></article>)}</div> : <EmptyState title="Sem refeições para este dia" /> : <Markdown className="content-card">{nutrition || "Nenhuma recomendação alimentar descrita para este dia."}</Markdown> : <WorkoutChecklist analysisId={analysis.id} weekday={day} />}
      </div> : null}
    </div>
  </section>;
}

function ScoreRing({ score, title, index, onClick }: { score: number; title: string; index: number; onClick: () => void }) {
  return <button type="button" className="score-widget" onClick={onClick} aria-label={`${title}: ${score} de 100`}>
    <span className="score-circle-wrapper" style={{ "--score": `${score} 100` } as CSSProperties}>
      <svg className="score-circle" viewBox="0 0 36 36" aria-hidden="true">
        <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        <path className={`circle-val tone-${index}`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
      </svg>
      <strong className="score-number">{score}</strong>
    </span>
    <span className="score-label">{title}</span>
  </button>;
}

function UploadPanel({ settings, onUpload, busy }: { settings: Settings; onUpload: (file: File, type: ClinicalDocument["type"]) => Promise<void>; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ClinicalDocument["type"]>("blood-test");
  function select(next?: File) {
    if (!next) return;
    if (next.type !== "application/pdf") return;
    setFile(next);
    const name = next.name.toLowerCase();
    setType(name.includes("bio") || name.includes("inbody") || name.includes("impedance") ? "bioimpedance" : "blood-test");
  }
  return <section className="upload-panel"><button type="button" className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); select(event.dataTransfer.files[0]); }}><strong>{busy ? "Processando documento..." : "Envie um novo laudo"}</strong><span>Arraste um PDF ou escolha no computador</span></button><input ref={inputRef} hidden type="file" accept="application/pdf" onChange={event => select(event.target.files?.[0])} />
    {file ? <div className="upload-confirm"><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(1)} MB</span></div><label>Tipo<select value={type} onChange={event => setType(event.target.value as ClinicalDocument["type"])}><option value="blood-test">Exame de sangue</option><option value="bioimpedance">Bioimpedância</option></select></label><div><button type="button" className="button secondary" onClick={() => setFile(null)}>Cancelar</button><button type="button" className="button primary" disabled={busy || !settings.hasKey} onClick={async () => { await onUpload(file, type); setFile(null); }}>Processar</button></div></div> : null}
  </section>;
}

export function Dashboard({ profile, analysis, documents, settings, detailTab, onDetailTab, onView, onUpload, uploadBusy }: {
  profile: Profile | null;
  analysis?: Analysis;
  documents: ClinicalDocument[];
  settings: Settings;
  detailTab: DetailTab;
  onDetailTab: (tab: DetailTab) => void;
  onView: (view: "profile" | "scores" | "history") => void;
  onUpload: (file: File, type: ClinicalDocument["type"]) => Promise<void>;
  uploadBusy: boolean;
}) {
  const scores = useMemo(() => calculateScores(analysis, profile), [analysis, profile]);
  if (!analysis) return <div className="dashboard"><section className="patient-strip"><div><span className="eyebrow">PERFIL</span><h1>{profile?.nome || "Paciente MedV2"}</h1><p>{profile?.idade || 0} anos · {profile?.sexo || "perfil incompleto"}</p></div><button type="button" className="text-button" onClick={() => onView("profile")}>Atualizar perfil</button></section><EmptyState title="Sua linha de cuidado começa com um exame">Envie um PDF de exame de sangue para gerar a primeira análise.</EmptyState><UploadPanel settings={settings} onUpload={onUpload} busy={uploadBusy} /></div>;

  return <div className="dashboard">
    <section className="patient-strip"><div><span className="eyebrow">PERFIL</span><h1>{profile?.nome || "Paciente MedV2"}</h1><p>{profile?.idade || 0} anos · {profile?.sexo || "perfil incompleto"}</p></div><div className="patient-facts"><span><small>Altura</small><strong>{profile?.altura || "—"} <em>cm</em></strong></span><span><small>Peso</small><strong>{profile?.peso || "—"} <em>kg</em></strong></span><span><small>IMC</small><strong>{profile?.imc || "—"}</strong></span></div><button type="button" className="text-button" onClick={() => onView("profile")}>Atualizar perfil</button></section>
    <AnalysisDetail analysis={analysis} activeTab={detailTab} onTab={onDetailTab} />
    <section className="dashboard-section"><SectionHeader title="Pontuações de Saúde" meta="Visão geral por sistemas"><button type="button" className="text-button" onClick={() => onView("scores")}>Ver composição</button></SectionHeader><div className="score-strip">{scores.slice(0, 4).map((item, index) => <ScoreRing key={item.key} score={item.score} title={item.title} index={index} onClick={() => onView("scores")} />)}</div></section>
    <section className="dashboard-section"><SectionHeader title="Documentos recentes" meta={`${documents.length} arquivados`}><button type="button" className="text-button" onClick={() => onView("history")}>Ver histórico</button></SectionHeader><UploadPanel settings={settings} onUpload={onUpload} busy={uploadBusy} />{documents.slice(0, 3).map(document => <a className="document-row" href={`/api/documents/${encodeURIComponent(document.id)}/file`} target="_blank" rel="noreferrer" key={document.id}><div><strong>{document.name}</strong><span>{document.type === "blood-test" ? "Exame de sangue" : "Bioimpedância"}</span></div><time>{formatDate(document.date)}</time></a>)}</section>
  </div>;
}
