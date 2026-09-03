import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { Notice, Skeleton } from "./components/common";
import { AuthScreen } from "./features/AuthScreen";
import { Dashboard } from "./features/Dashboard";
import { History } from "./features/History";
import { Labs } from "./features/Labs";
import { ProfileForm } from "./features/ProfileForm";
import { Scores } from "./features/Scores";
import { SettingsDialog } from "./features/SettingsDialog";
import { Backoffice } from "./features/Backoffice";
import { ApiError, api } from "./lib/api";
import type { Analysis, ClinicalDocument, DetailTab, Profile, Session, Settings, StructuredBiomarker, ViewId } from "./types";

const emptySettings: Settings = { hasKey: false, modelExtraction: "google/gemini-2.5-flash", modelAnalysis: "google/gemini-2.5-pro", lens: "longevidade" };

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [biomarkers, setBiomarkers] = useState<StructuredBiomarker[]>([]);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [view, setView] = useState<ViewId>("dashboard");
  const [detailTab, setDetailTab] = useState<DetailTab>("status");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [annotationsBusy, setAnnotationsBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "danger" } | null>(null);

  const notify = useCallback((message: string, tone: "success" | "danger" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(current => current?.message === message ? null : current), 3500);
  }, []);

  const loadClinicalData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsResult, profileResult, documentsResult, analysesResult, biomarkersResult] = await Promise.all([
        api.settings(), api.profile(), api.documents(), api.analyses(), api.biomarkers()
      ]);
      setSettings(settingsResult.settings);
      setProfile(profileResult.profile);
      setDocuments(documentsResult.documents);
      setAnalyses(analysesResult.analyses);
      setBiomarkers(biomarkersResult.biomarkers);
      setActiveAnalysisId(current => analysesResult.analyses.some(item => item.id === current) ? current : analysesResult.analyses[0]?.id ?? null);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) setSession(null);
      else setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados clínicos.");
    } finally { setLoading(false); }
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.session();
      if (next?.user) {
        const identity = await api.me();
        const sessionWithRole = { ...next, user: { ...next.user, ...identity.user } };
        setSession(sessionWithRole);
        await loadClinicalData();
      } else {
        setSession(null);
        setLoading(false);
      }
    } catch {
      setSession(null);
      setLoading(false);
    }
  }, [loadClinicalData]);

  useEffect(() => { refreshSession(); }, [refreshSession]);
  const activeAnalysis = useMemo(() => analyses.find(item => item.id === activeAnalysisId), [analyses, activeAnalysisId]);

  async function logout() {
    try { await api.signOut(); } finally { setSession(null); }
  }

  function selectAnalysis(id: string) {
    setActiveAnalysisId(id);
    setDetailTab("status");
    setView("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function upload(file: File, type: ClinicalDocument["type"]) {
    setUploadBusy(true);
    try {
      const result = await api.upload(file, type);
      await loadClinicalData();
      if (result.analysis) setActiveAnalysisId(result.analysis.id);
      setView("dashboard");
      setDetailTab("status");
      notify(result.message || "Documento processado.");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Não foi possível processar o documento.", "danger");
    } finally { setUploadBusy(false); }
  }

  async function saveProfile(next: Profile) {
    setProfileBusy(true);
    try {
      const result = await api.saveProfile(next);
      setProfile(result.profile);
      setView("dashboard");
      notify(result.message || "Perfil atualizado.");
    } catch (cause) { notify(cause instanceof Error ? cause.message : "Não foi possível salvar o perfil.", "danger"); }
    finally { setProfileBusy(false); }
  }

  async function saveAnnotations(value: string) {
    if (!activeAnalysis) return;
    setAnnotationsBusy(true);
    try {
      const result = await api.saveAnnotations(activeAnalysis.id, value);
      setAnalyses(current => current.map(item => item.id === result.analysis.id ? result.analysis : item));
      setBiomarkers(current => current.map(item => item.analysisId === result.analysis.id ? { ...item, annotations: value } : item));
      notify(result.message || "Contexto salvo.");
    } catch (cause) { notify(cause instanceof Error ? cause.message : "Não foi possível salvar o contexto.", "danger"); }
    finally { setAnnotationsBusy(false); }
  }

  if (session === undefined) return <div className="boot-screen"><div><span>// MedV2</span><Skeleton rows={3} /></div></div>;
  if (!session) return <AuthScreen onAuthenticated={refreshSession} />;
  const professional = session.user?.role === "professional";

  return <>
    <AppShell view={view} onView={setView} profile={profile} analyses={analyses} activeAnalysisId={activeAnalysisId} onAnalysis={selectAnalysis} settings={settings} loading={loading} onSettings={() => setSettingsOpen(true)} onLogout={logout} professional={professional}>
      {error ? <Notice tone="danger"><div><strong>Não foi possível carregar o MedV2</strong><span>{error}</span></div><button type="button" className="button small" onClick={loadClinicalData}>Tentar novamente</button></Notice> : null}
      {loading ? <Skeleton rows={8} /> : null}
      {!loading && !error && view === "dashboard" ? <Dashboard profile={profile} analysis={activeAnalysis} documents={documents} settings={settings} detailTab={detailTab} onDetailTab={tab => { setDetailTab(tab); document.querySelector(".analysis-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} onView={setView} onUpload={upload} uploadBusy={uploadBusy} /> : null}
      {!loading && !error && view === "labs" ? <Labs analyses={analyses} rows={biomarkers} activeAnalysis={activeAnalysis} onSaveAnnotations={saveAnnotations} saving={annotationsBusy} /> : null}
      {!loading && !error && view === "scores" ? <Scores analysis={activeAnalysis} profile={profile} /> : null}
      {!loading && !error && view === "profile" && profile ? <ProfileForm profile={profile} onSave={saveProfile} busy={profileBusy} /> : null}
      {!loading && !error && view === "history" ? <History analyses={analyses} documents={documents} onAnalysis={selectAnalysis} /> : null}
      {!loading && !error && view === "backoffice" && professional ? <Backoffice /> : null}
    </AppShell>
    <SettingsDialog open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSaved={setSettings} notify={notify} />
    {toast ? <div className={`toast ${toast.tone}`} role="status">{toast.message}</div> : null}
  </>;
}
