import { useEffect, useState } from "react";
import { Dialog, EmptyState, Notice, SectionHeader, Skeleton } from "../components/common";
import { ApiError, api } from "../lib/api";
import type { Weekday, WorkoutChecklist as WorkoutChecklistData, WorkoutChecklistTask } from "../types";

function taskStatusLabel(task: WorkoutChecklistTask): string {
  if (task.status === "review") return "Revisar exercício";
  if (task.status === "completed") return "Concluído";
  return "Pendente";
}

type WorkoutMediaMode = "animation" | "image" | "hidden";

export function WorkoutChecklist({ analysisId, weekday }: { analysisId: string; weekday: Weekday }) {
  const [checklist, setChecklist] = useState<WorkoutChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingTaskKey, setSavingTaskKey] = useState<string | null>(null);
  const [mediaModes, setMediaModes] = useState<Record<string, WorkoutMediaMode>>({});
  const [selectedMedia, setSelectedMedia] = useState<{ src: string; alt: string; title: string } | null>(null);

  useEffect(() => {
    if (!selectedMedia) return;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedMedia(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [selectedMedia]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setChecklist(null);
    setMediaModes({});
    api.workoutChecklist(analysisId, weekday)
      .then((result) => { if (!cancelled) setChecklist(result.checklist); })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o treino.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [analysisId, weekday]);

  async function toggleTask(task: WorkoutChecklistTask) {
    if (task.status === "review" || savingTaskKey) return;
    setSavingTaskKey(task.taskKey);
    setError("");
    try {
      const result = await api.updateWorkoutTaskCompletion({
        analysisId,
        weekday,
        taskKey: task.taskKey,
        completed: task.status !== "completed"
      });
      setChecklist((current) => current ? {
        ...current,
        day: {
          ...current.day,
          tasks: current.day.tasks.map((candidate) => candidate.taskKey === task.taskKey
            ? { ...candidate, status: result.completion.completed ? "completed" : "pending" }
            : candidate)
        }
      } : current);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível atualizar a tarefa.");
    } finally { setSavingTaskKey(null); }
  }

  if (loading) return <section className="content-card"><SectionHeader title="Checklist do treino" meta="Carregando" /><Skeleton rows={4} /></section>;
  if (error && !checklist) return <Notice tone="danger"><div><strong>Checklist indisponível</strong><span>{error}</span></div></Notice>;
  if (!checklist) return null;

  const tasks = checklist.day.tasks;
  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const reviewCount = tasks.filter((task) => task.status === "review").length;

  function defaultMediaMode(task: WorkoutChecklistTask): WorkoutMediaMode {
    if (task.animationUrl) return "animation";
    if (task.imageUrl) return "image";
    return "hidden";
  }

  function mediaModeFor(task: WorkoutChecklistTask): WorkoutMediaMode {
    return mediaModes[task.taskKey] || defaultMediaMode(task);
  }

  function mediaSourceFor(task: WorkoutChecklistTask, mode = mediaModeFor(task)): string | null {
    if (mode === "animation") return task.animationUrl || task.imageUrl;
    if (mode === "image") return task.imageUrl || task.animationUrl;
    return null;
  }

  function handleMediaError(task: WorkoutChecklistTask) {
    setMediaModes((current) => ({
      ...current,
      [task.taskKey]: current[task.taskKey] === "animation" && task.imageUrl ? "image" : "hidden"
    }));
  }

  function toggleMedia(task: WorkoutChecklistTask) {
    if (!task.animationUrl || !task.imageUrl) return;
    setMediaModes((current) => ({
      ...current,
      [task.taskKey]: (current[task.taskKey] || defaultMediaMode(task)) === "animation" ? "image" : "animation"
    }));
  }

  function openMedia(task: WorkoutChecklistTask) {
    const src = mediaSourceFor(task);
    if (!src) return;
    const title = task.exerciseName || task.sourceExerciseName;
    setSelectedMedia({ src, title, alt: `Imagem ampliada de ${title}` });
  }

  return <section className="content-card workout-checklist" aria-label="Checklist do treino">
    <SectionHeader
      title={checklist.day.title}
      meta={tasks.length ? `${completedCount}/${tasks.length} concluídos` : "Sem exercícios estruturados"}
    />
    {error ? <Notice tone="danger"><div><strong>Não foi possível salvar</strong><span>{error}</span></div></Notice> : null}
    {checklist.day.isRestDay || tasks.length === 0 ? <EmptyState title={checklist.day.isRestDay ? "Descanso programado" : "Nenhum exercício identificado"}>{checklist.day.message || "Não há tarefas estruturadas para este dia."}</EmptyState> : <>
      {reviewCount ? <p className="workout-review-note">{reviewCount} item(ns) precisam de revisão antes de serem concluídos.</p> : null}
      <div className="workout-task-list">
        {tasks.map((task) => <article className={`workout-task ${task.status}`} key={task.taskKey}>
          <button
            type="button"
            className="workout-task-toggle"
            aria-label={`${task.sourceExerciseName}: ${taskStatusLabel(task)}`}
            aria-pressed={task.status === "completed"}
            disabled={task.status === "review" || savingTaskKey !== null}
            onClick={() => toggleTask(task)}
          >
            <span aria-hidden="true">{task.status === "completed" ? "✓" : task.status === "review" ? "!" : "○"}</span>
          </button>
          <div className="workout-task-content">
            <header className="workout-task-heading">
              <div className="workout-task-copy">
                <div className="workout-task-title-row">
                  <h3>{task.exerciseName || task.sourceExerciseName}</h3>
                </div>
                {task.exerciseName && task.exerciseName !== task.sourceExerciseName ? <span>Solicitado na análise: {task.sourceExerciseName}</span> : null}
                <span className="workout-task-status">{taskStatusLabel(task)}</span>
              </div>
              {mediaSourceFor(task) ? <div className="workout-task-media-shell">
                <button type="button" className="workout-task-media" onClick={() => openMedia(task)} aria-label={`Ampliar imagem de ${task.exerciseName || task.sourceExerciseName}`}>
                  <img
                    src={mediaSourceFor(task) || undefined}
                    alt={`Ilustração de ${task.exerciseName || task.sourceExerciseName}`}
                    loading="lazy"
                    onError={() => handleMediaError(task)}
                  />
                </button>
                {task.animationUrl && task.imageUrl ? <button
                  type="button"
                  className="workout-task-media-toggle"
                  onClick={() => toggleMedia(task)}
                  aria-label={mediaModeFor(task) === "animation" ? "Pausar animação" : "Reproduzir animação"}
                >
                  {mediaModeFor(task) === "animation" ? "Ⅱ  Pausar" : "▶  Reproduzir"}
                </button> : null}
              </div> : null}
            </header>
            {task.prescription ? <p className="workout-prescription">{task.prescription}</p> : null}
            {task.reviewReason ? <p className="workout-task-review">{task.reviewReason}</p> : null}
            {task.steps.length ? <details className="workout-instructions"><summary>Instruções</summary><ol>{task.steps.map((step, index) => <li key={`${task.taskKey}-step-${index}`}>{step}</li>)}</ol></details> : null}
          </div>
        </article>)}
      </div>
    </>}
    <p className="medical-note">Checklist informativa baseada na análise selecionada. Não substitui avaliação, diagnóstico ou prescrição profissional.</p>
    <Dialog title={selectedMedia?.title || "Imagem do exercício"} titleId="exercise-media-dialog-title" className="exercise-media-dialog" open={selectedMedia !== null} onClose={() => setSelectedMedia(null)}>
      {selectedMedia ? <>
        <div className="exercise-media-viewer"><img src={selectedMedia.src} alt={selectedMedia.alt} /></div>
        <p className="exercise-media-caption">Visualização ampliada da imagem ilustrativa do exercício.</p>
      </> : null}
    </Dialog>
  </section>;
}
