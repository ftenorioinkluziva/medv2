import { useEffect, useMemo, useState } from "react";
import { EmptyState, Markdown, Notice, SectionHeader } from "../components/common";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import type { BackofficePatient, BackofficePlanEditor, Exercise, Meal, PlanContent, Supplement, TrainingDay, TrainingItem, TrainingItemKind, TrainingPlan, Weekday } from "../types";

const weekdays: Weekday[] = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const shortDay: Record<Weekday, string> = { "Segunda-feira": "Seg", "Terça-feira": "Ter", "Quarta-feira": "Qua", "Quinta-feira": "Qui", "Sexta-feira": "Sex", "Sábado": "Sáb", "Domingo": "Dom" };
const emptyMeal: Meal = { name: "", time: "", description: "", proteinGrams: 0, fatGrams: 0, carbsGrams: 0 };

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function initialContent(editor: BackofficePlanEditor): PlanContent {
  return clone(editor.draft?.content || editor.published?.content || editor.generated);
}

function updateDay(content: PlanContent, day: Weekday, value: string | Meal[]): PlanContent {
  return { ...content, nutritionPlan: { ...content.nutritionPlan, [day]: value } };
}

function SupplementEditor({ content, onChange }: { content: PlanContent; onChange: (next: PlanContent) => void }) {
  function update(index: number, field: keyof Supplement, value: string) {
    const supplementation = content.supplementation.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item);
    onChange({ ...content, supplementation });
  }
  return <div className="backoffice-section"><SectionHeader title="Suplementação" meta={`${content.supplementation.length} ${content.supplementation.length === 1 ? "item" : "itens"} no plano`} /><div className="backoffice-list">{content.supplementation.map((item, index) => <article className="backoffice-card supplement-edit-card" key={`${index}-${item.name}`}>
    <header className="backoffice-item-header"><div className="backoffice-item-title"><span className="backoffice-item-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.name || "Novo suplemento"}</strong><span>Item de suplementação</span></div></div><button type="button" className="text-button backoffice-remove" onClick={() => onChange({ ...content, supplementation: content.supplementation.filter((_, itemIndex) => itemIndex !== index) })}>Remover</button></header>
    <div className="backoffice-field-grid supplement-fields"><label className="wide"><span>Nome</span><input value={item.name} placeholder="Ex.: Magnésio bisglicinato" onChange={event => update(index, "name", event.target.value)} /></label><label className="wide"><span>Finalidade</span><textarea rows={2} value={item.purpose} placeholder="Por que este item faz parte do plano" onChange={event => update(index, "purpose", event.target.value)} /></label><label><span>Dose</span><input value={item.dose} placeholder="Ex.: 200 mg" onChange={event => update(index, "dose", event.target.value)} /></label><label><span>Frequência</span><input value={item.frequency} placeholder="Ex.: 1x ao dia" onChange={event => update(index, "frequency", event.target.value)} /></label></div>
  </article>)}</div><button type="button" className="button secondary" onClick={() => onChange({ ...content, supplementation: [...content.supplementation, { name: "", purpose: "", dose: "", frequency: "" }] })}>Adicionar suplemento</button></div>;
}

function MealEditor({ meals, onChange }: { meals: Meal[]; onChange: (next: Meal[]) => void }) {
  function update(index: number, field: keyof Meal, value: string) {
    onChange(meals.map((meal, mealIndex) => mealIndex === index ? { ...meal, [field]: field.endsWith("Grams") ? Number(value) : value } : meal));
  }
  return <div className="backoffice-list">{meals.map((meal, index) => <article className="backoffice-card" key={`${index}-${meal.name}`}><div className="backoffice-field-grid"><label><span>Horário</span><input value={meal.time} onChange={event => update(index, "time", event.target.value)} /></label><label><span>Nome</span><input value={meal.name} onChange={event => update(index, "name", event.target.value)} /></label><label className="wide"><span>Descrição</span><textarea rows={3} value={meal.description} onChange={event => update(index, "description", event.target.value)} /></label><label><span>Proteína (g)</span><input type="number" min="0" value={meal.proteinGrams} onChange={event => update(index, "proteinGrams", event.target.value)} /></label><label><span>Carboidrato (g)</span><input type="number" min="0" value={meal.carbsGrams} onChange={event => update(index, "carbsGrams", event.target.value)} /></label><label><span>Gordura (g)</span><input type="number" min="0" value={meal.fatGrams} onChange={event => update(index, "fatGrams", event.target.value)} /></label></div><button type="button" className="text-button backoffice-remove" onClick={() => onChange(meals.filter((_, mealIndex) => mealIndex !== index))}>Remover refeição</button></article>)}</div>;
}

function NutritionEditor({ content, onChange }: { content: PlanContent; onChange: (next: PlanContent) => void }) {
  const [day, setDay] = useState<Weekday>(weekdays[0]);
  const value = content.nutritionPlan[day];
  return <div className="backoffice-section"><SectionHeader title="Nutrição" meta="Orientação e plano por dia" /><label><span>Orientação geral</span><textarea rows={7} value={content.nutritionOrientation} onChange={event => onChange({ ...content, nutritionOrientation: event.target.value })} /></label><div className="backoffice-day-tabs" role="tablist" aria-label="Dia da nutrição">{weekdays.map(item => <button type="button" className={day === item ? "active" : ""} aria-selected={day === item} key={item} onClick={() => setDay(item)}>{shortDay[item]}</button>)}</div>{Array.isArray(value) ? <><MealEditor meals={value} onChange={meals => onChange(updateDay(content, day, meals))} /><button type="button" className="button secondary" onClick={() => onChange(updateDay(content, day, [...value, emptyMeal]))}>Adicionar refeição</button></> : <><label><span>Conteúdo do dia</span><textarea rows={10} value={value} onChange={event => onChange(updateDay(content, day, event.target.value))} /></label><p className="backoffice-hint">Este dia está no formato textual gerado pela análise.</p></>}</div>;
}

function prescriptionFor(item: TrainingItem): string {
  const fields = [
    item.sets && item.reps ? `${item.sets} séries de ${item.reps} repetições` : "",
    item.duration,
    item.rest && item.kind !== "rest" ? `Descanso: ${item.rest}` : "",
    item.notes ? `(${item.notes})` : ""
  ].filter(Boolean);
  return fields.join(" ") || item.prescription;
}

function newTrainingItem(kind: TrainingItemKind = "exercise"): TrainingItem {
  return { id: `manual-${crypto.randomUUID()}`, kind, name: kind === "rest" ? "Descanso" : "Novo exercício", exerciseId: null, sets: kind === "exercise" ? 3 : null, reps: kind === "exercise" ? "10" : "", duration: "", rest: "", notes: "", prescription: "" };
}

function ExercisePicker({ item, onSelect }: { item: TrainingItem; onSelect: (exercise: Exercise) => void }) {
  const [query, setQuery] = useState(item.name);
  const [results, setResults] = useState<Exercise[]>([]);
  useEffect(() => {
    if (item.kind === "rest") return;
    if (!query.trim()) { setResults([]); return; }
    const timer = window.setTimeout(() => { api.exercises(query.trim()).then(result => setResults(result.exercises)).catch(() => setResults([])); }, 250);
    return () => window.clearTimeout(timer);
  }, [query, item.kind]);
  const selected = results.find(exercise => exercise.id === item.exerciseId);
  const displayName = (exercise: Exercise) => exercise.namePt ? `${exercise.namePt[0].toUpperCase()}${exercise.namePt.slice(1)} · ${exercise.n}` : exercise.n;
  return <div className="backoffice-catalog-picker"><label><span>Buscar exercício no catálogo</span><input value={query} placeholder="Português ou inglês: leg press, supino..." onChange={event => setQuery(event.target.value)} /></label>{results.length ? <select aria-label="Exercício do catálogo" value={item.exerciseId || ""} onChange={event => { const selectedExercise = results.find(exercise => exercise.id === event.target.value); if (selectedExercise) onSelect(selectedExercise); }}><option value="">Selecione um exercício catalogado</option>{results.map(exercise => <option key={exercise.id} value={exercise.id}>{displayName(exercise)} · {exercise.bp || "sem região"}</option>)}</select> : null}{selected ? <div className="backoffice-catalog-details">{selected.img ? <img src={`/api/exercises/${encodeURIComponent(selected.id)}/media/image`} alt="" loading="lazy" /> : null}<div><strong>{displayName(selected)}</strong><span>Região: {selected.bp || "não informada"} · Equipamento: {selected.eq || "não informado"}</span><span>Músculo-alvo: {selected.tg || "não informado"} · Principal: {selected.mg || "não informado"}</span>{selected.sm?.length ? <span>Auxiliares: {selected.sm.join(", ")}</span> : null}{selected.stPt?.length ? <details><summary>Instruções do catálogo</summary><ol>{selected.stPt.map((step, stepIndex) => <li key={`${selected.id}-step-${stepIndex}`}>{step}</li>)}</ol></details> : null}</div></div> : null}<p className="backoffice-hint">A seleção grava o ID do catálogo. O nome exibido e as instruções passam a ser os dados canônicos do exercício escolhido.</p></div>;
}

function TrainingItemEditor({ item, index, onChange, onRemove, onMove }: { item: TrainingItem; index: number; onChange: (next: TrainingItem) => void; onRemove: () => void; onMove: (direction: -1 | 1) => void }) {
  function update(field: keyof TrainingItem, value: string | number | null) {
    const next = { ...item, [field]: value } as TrainingItem;
    onChange({ ...next, prescription: prescriptionFor(next) });
  }
  const kindLabels: Record<TrainingItemKind, string> = { exercise: "Exercício", activity: "Atividade/cardio", warmup: "Aquecimento", mobility: "Mobilidade", rest: "Descanso" };
  const isCatalogItem = item.kind !== "rest";
  return <article className="backoffice-card training-item-card"><header className="training-item-heading"><div className="backoffice-item-title"><span className="backoffice-item-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.name || "Item sem nome"}</strong><span>{kindLabels[item.kind]} · {item.exerciseId ? "Catálogo vinculado" : isCatalogItem ? "Seleção pendente" : "Configuração manual"}</span></div></div><div className="training-item-actions"><button type="button" className="text-button" onClick={() => onMove(-1)} disabled={index === 0}>Subir</button><button type="button" className="text-button" onClick={() => onMove(1)}>Descer</button><button type="button" className="text-button backoffice-remove" onClick={onRemove}>Remover</button></div></header><div className="backoffice-field-grid training-item-fields"><label><span>Tipo</span><select value={item.kind} onChange={event => update("kind", event.target.value)}><option value="exercise">Exercício</option><option value="activity">Atividade/cardio</option><option value="warmup">Aquecimento</option><option value="mobility">Mobilidade</option><option value="rest">Descanso</option></select></label>{isCatalogItem ? <div className="wide"><ExercisePicker item={item} onSelect={exercise => onChange({ ...item, name: exercise.namePt ? `${exercise.namePt[0].toUpperCase()}${exercise.namePt.slice(1)}` : exercise.n, exerciseId: exercise.id, prescription: prescriptionFor({ ...item, name: exercise.n, exerciseId: exercise.id }) })} /></div> : <label className="wide"><span>Nome do item</span><input value={item.name} onChange={event => update("name", event.target.value)} /></label>}{item.kind !== "exercise" && item.kind !== "activity" && item.kind !== "rest" && !item.exerciseId ? <label className="wide"><span>Nome/descrição manual (opcional)</span><input value={item.name} onChange={event => update("name", event.target.value)} /></label> : null}<label><span>Séries</span><input type="number" min="0" value={item.sets ?? ""} onChange={event => update("sets", event.target.value === "" ? null : Number(event.target.value))} /></label><label><span>Repetições</span><input value={item.reps} onChange={event => update("reps", event.target.value)} /></label><label><span>Duração</span><input value={item.duration} placeholder="Ex.: 5 min" onChange={event => update("duration", event.target.value)} /></label><label><span>Descanso</span><input value={item.rest} placeholder="Ex.: 60 s" onChange={event => update("rest", event.target.value)} /></label><label className="wide"><span>Observações e instruções adicionais</span><textarea rows={3} value={item.notes} onChange={event => update("notes", event.target.value)} /></label></div></article>;
}

function TrainingEditor({ content, onChange }: { content: PlanContent; onChange: (next: PlanContent) => void }) {
  const [day, setDay] = useState<Weekday>(weekdays[0]);
  if (!content.trainingPlanStructured) return <div className="backoffice-section"><SectionHeader title="Treino" meta="Plano sem estrutura editável" /><Notice tone="warning"><div><strong>Treino legado</strong><span>Este plano precisa ser reaberto e convertido antes da edição profissional.</span></div></Notice></div>;
  const plan: TrainingPlan = content.trainingPlanStructured;
  const trainingDay: TrainingDay = plan[day];
  function updateDay(nextDay: TrainingDay) { onChange({ ...content, trainingPlanStructured: { ...plan, [day]: nextDay } }); }
  function updateItem(index: number, item: TrainingItem) { updateDay({ ...trainingDay, items: trainingDay.items.map((current, itemIndex) => itemIndex === index ? item : current) }); }
  function moveItem(index: number, direction: -1 | 1) { const items = [...trainingDay.items]; const target = index + direction; if (target < 0 || target >= items.length) return; [items[index], items[target]] = [items[target], items[index]]; updateDay({ ...trainingDay, items }); }
  return <div className="backoffice-section"><SectionHeader title="Treino" meta="Estruturado por exercício e validado pelo catálogo local" /><label><span>Orientação geral</span><textarea rows={7} value={content.trainingOrientation} onChange={event => onChange({ ...content, trainingOrientation: event.target.value })} /></label><div className="backoffice-day-tabs" role="tablist" aria-label="Dia do treino">{weekdays.map(item => <button type="button" className={day === item ? "active" : ""} aria-selected={day === item} key={item} onClick={() => setDay(item)}>{shortDay[item]}</button>)}</div><div className="backoffice-field-grid"><label className="wide"><span>Título do dia</span><input value={trainingDay.title} onChange={event => updateDay({ ...trainingDay, title: event.target.value })} /></label></div><div className="backoffice-list">{trainingDay.items.map((item, index) => <TrainingItemEditor key={item.id} item={item} index={index} onChange={next => updateItem(index, next)} onRemove={() => updateDay({ ...trainingDay, items: trainingDay.items.filter((_, itemIndex) => itemIndex !== index) })} onMove={direction => moveItem(index, direction)} />)}</div><div className="backoffice-add-row"><button type="button" className="button secondary" onClick={() => updateDay({ ...trainingDay, items: [...trainingDay.items, newTrainingItem("exercise")] })}>Adicionar exercício</button><button type="button" className="button secondary" onClick={() => updateDay({ ...trainingDay, items: [...trainingDay.items, newTrainingItem("warmup")] })}>Adicionar atividade/descanso</button></div><p className="backoffice-hint">A IA pode continuar gerando texto. Antes de chegar ao paciente, o sistema converte esse texto para esta estrutura; o profissional edita os campos e publica uma nova versão.</p></div>;
}

function Editor({ editor, onSaved }: { editor: BackofficePlanEditor; onSaved: () => Promise<void> }) {
  const [content, setContent] = useState<PlanContent>(() => initialContent(editor));
  const [tab, setTab] = useState<"supplements" | "nutrition" | "training">("supplements");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setContent(initialContent(editor)); }, [editor]);
  async function save(publish: boolean) {
    setBusy(true); setError(""); setMessage("");
    try {
      await api.saveBackofficeDraft(editor.patient.id, editor.analysis.id, content);
      if (publish) await api.publishBackofficePlan(editor.patient.id, editor.analysis.id);
      setMessage(publish ? "Plano publicado com sucesso." : "Rascunho salvo com sucesso.");
      await onSaved();
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Não foi possível salvar o plano."); }
    finally { setBusy(false); }
  }
  return <div className="backoffice-editor"><header className="backoffice-editor-header"><div><span className="eyebrow">PLANO CLÍNICO</span><h2>{editor.patient.name}</h2><p>{formatDate(editor.analysis.date)} · {editor.analysis.bloodTestFilename || "Exame"}</p></div><div className="backoffice-status"><span>{editor.draft ? `Rascunho v${editor.draft.version}` : editor.published ? `Publicado v${editor.published.version}` : "Gerado pela IA"}</span></div></header>{error ? <Notice tone="danger"><div><strong>Não foi possível salvar</strong><span>{error}</span></div></Notice> : null}{message ? <Notice tone="success"><div><strong>Alteração concluída</strong><span>{message}</span></div></Notice> : null}<div className="backoffice-tabs" role="tablist" aria-label="Editor do plano"><button type="button" className={tab === "supplements" ? "active" : ""} onClick={() => setTab("supplements")}>Suplementação</button><button type="button" className={tab === "nutrition" ? "active" : ""} onClick={() => setTab("nutrition")}>Nutrição</button><button type="button" className={tab === "training" ? "active" : ""} onClick={() => setTab("training")}>Treino</button></div>{tab === "supplements" ? <SupplementEditor content={content} onChange={setContent} /> : null}{tab === "nutrition" ? <NutritionEditor content={content} onChange={setContent} /> : null}{tab === "training" ? <TrainingEditor content={content} onChange={setContent} /> : null}<div className="backoffice-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => save(false)}>{busy ? "Salvando..." : "Salvar rascunho"}</button><button type="button" className="button primary" disabled={busy} onClick={() => save(true)}>Publicar plano</button></div><details className="backoffice-history"><summary>Histórico de versões ({editor.history.length})</summary>{editor.history.length ? <div>{editor.history.map(revision => <p key={revision.id}><strong>v{revision.version}</strong> · {revision.status === "published" ? "publicada" : revision.status === "draft" ? "rascunho" : "arquivada"} · {formatDate(revision.updatedAt)}</p>)}</div> : <p>Nenhuma revisão manual publicada.</p>}</details><div className="backoffice-preview"><SectionHeader title="Nota de publicação" meta="Visível para o paciente" /><Markdown>O conteúdo revisado continua sendo informativo e não substitui avaliação, diagnóstico ou prescrição profissional.</Markdown></div></div>;
}

export function Backoffice() {
  const [patients, setPatients] = useState<BackofficePatient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [editor, setEditor] = useState<BackofficePlanEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedPatient = useMemo(() => patients.find(patient => patient.id === patientId), [patients, patientId]);
  useEffect(() => { api.backofficePatients().then(result => { setPatients(result.patients); const first = result.patients[0]; setPatientId(first?.id || ""); setAnalysisId(first?.analyses[0]?.id || ""); }).catch(cause => setError(cause instanceof Error ? cause.message : "Não foi possível carregar os pacientes.")).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!patientId || !analysisId) { setEditor(null); return; } setLoading(true); api.backofficePlan(patientId, analysisId).then(result => setEditor(result.editor)).catch(cause => setError(cause instanceof Error ? cause.message : "Não foi possível carregar o plano.")).finally(() => setLoading(false)); }, [patientId, analysisId]);
  async function reloadEditor() { const result = await api.backofficePlan(patientId, analysisId); setEditor(result.editor); }
  if (loading && !editor) return <div className="page-stack"><div className="skeleton"><span /><span /><span /></div></div>;
  return <div className="backoffice-page"><section className="content-card"><SectionHeader title="Backoffice profissional" meta="Edição de planos publicados" /><div className="backoffice-selectors"><label><span>Paciente</span><select value={patientId} onChange={event => { const next = patients.find(patient => patient.id === event.target.value); setPatientId(event.target.value); setAnalysisId(next?.analyses[0]?.id || ""); }}>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name} · {patient.email}</option>)}</select></label><label><span>Análise</span><select value={analysisId} onChange={event => setAnalysisId(event.target.value)}>{selectedPatient?.analyses.map(analysis => <option key={analysis.id} value={analysis.id}>{formatDate(analysis.date)} · {analysis.bloodTestFilename || "Exame"}</option>)}</select></label></div>{error ? <Notice tone="danger"><div><strong>Backoffice indisponível</strong><span>{error}</span></div></Notice> : null}</section>{!patients.length && !error ? <EmptyState title="Nenhum paciente disponível">As análises de pacientes aparecerão aqui.</EmptyState> : null}{editor ? <Editor editor={editor} onSaved={reloadEditor} /> : null}</div>;
}
