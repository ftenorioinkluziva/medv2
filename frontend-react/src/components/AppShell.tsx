import type { ReactNode } from "react";
import { Brand, Notice } from "./common";
import { formatDate } from "../lib/format";
import type { Analysis, Profile, Settings, ViewId } from "../types";

const views: Array<[ViewId, string]> = [["dashboard", "Painel"], ["labs", "Labs"], ["scores", "Sistemas"], ["profile", "Perfil"], ["history", "Histórico"]];

export function AppShell({ children, view, onView, profile, analyses, activeAnalysisId, onAnalysis, settings, loading, onSettings, onLogout }: {
  children: ReactNode;
  view: ViewId;
  onView: (view: ViewId) => void;
  profile: Profile | null;
  analyses: Analysis[];
  activeAnalysisId: string | null;
  onAnalysis: (id: string) => void;
  settings: Settings;
  loading: boolean;
  onSettings: () => void;
  onLogout: () => void;
}) {
  return <div className="app-shell">
    <header className="topbar">
      <button type="button" className="brand-button" onClick={() => onView("dashboard")}><Brand /></button>
      <div className="topbar-user"><span>Olá, <strong>{profile?.nome || "Paciente"}</strong></span><button type="button" className="icon-button" onClick={onSettings} aria-label="Configurações">⚙</button><button type="button" className="icon-button" onClick={onLogout} aria-label="Sair">↪</button></div>
    </header>
    <nav className="primary-nav" aria-label="Navegação principal">{views.map(([id, label]) => <button type="button" key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => onView(id)}>{label}</button>)}</nav>
    {!loading && !settings.hasKey ? <Notice tone="warning"><div><strong>OpenRouter não configurada</strong><span>Defina OPENROUTER_API_KEY no servidor para processar novos documentos.</span></div><button type="button" className="button small" onClick={onSettings}>Configurar</button></Notice> : null}
    {analyses.length ? <section className="analysis-context" aria-label="Análise ativa"><label><span>Visualizando exames de</span><select value={activeAnalysisId ?? ""} onChange={event => onAnalysis(event.target.value)}>{analyses.map(analysis => <option key={analysis.id} value={analysis.id}>{formatDate(analysis.date)} · {analysis.bloodTestFilename || "Exame"}</option>)}</select></label>{activeAnalysisId !== analyses[0]?.id ? <button type="button" className="text-button" onClick={() => onAnalysis(analyses[0].id)}>Ver mais recente</button> : null}</section> : null}
    <main className="app-content">{children}</main>
  </div>;
}
