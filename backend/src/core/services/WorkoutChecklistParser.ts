import { DETERMINISTIC_ALIASES } from "./WorkoutExerciseAliases";
import { Exercise } from "../schemas/exercise";
import { Weekday } from "../schemas/workout-checklist";
import { TrainingDay, TrainingItemKind } from "../schemas/training-plan";

export interface ParsedWorkoutTask {
  sourceExerciseName: string;
  prescription: string;
}

export interface ParsedWorkoutItem {
  name: string;
  sourceExerciseName: string | null;
  prescription: string;
  kind: TrainingItemKind;
  sets: number | null;
  reps: string;
  duration: string;
  rest: string;
  notes: string;
}

export interface ParsedWorkoutDay {
  title: string;
  message: string;
  isRestDay: boolean;
  tasks: ParsedWorkoutTask[];
}

const IGNORED_LABELS = [
  "atividade",
  "aquecimento",
  "atividade",
  "alongamento",
  "cardio",
  "desaquecimento",
  "descanso",
  "duracao",
  "foco",
  "intensidade",
  "lazer",
  "mobilidade",
  "liberacao",
  "modalidade",
  "nota",
  "notas",
  "observacao",
  "observacoes",
  "objetivo",
  "opcoes",
  "pausa",
  "protocolo",
  "preparacao",
  "recuperacao",
  "zona"
];

const CATALOG_ALIASES: Record<string, string> = {
  ...DETERMINISTIC_ALIASES,
  "puxada frontal pulley": "0197",
  "elevacao pelvica hip thrust com barra": "1409",
  "levantamento terra stiff com halteres": "1459",
  "remada na maquina sentado": "1350",
  "agachamento taca goblet squat": "1760",
  "prancha abdominal": "0464",
  "bicicleta spinning": "2138",
  "bicicleta de spinning": "2138",
  "spinning": "2138",
  "eliptico": "2141",
  "esteira": "3666",
  "caminhada rapida": "3666"
};

export function normalizeWorkoutText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripListPrefix(value: string): string {
  return value.replace(/^(?:[-+*]\s+|\d+[.)]\s+)/, "").trim();
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .trim();
}

function cleanExerciseLabel(value: string): string {
  return stripMarkdown(value).replace(/\s*:\s*$/, "").trim();
}

function isIgnoredLabel(value: string): boolean {
  const normalized = normalizeWorkoutText(cleanExerciseLabel(value));
  return /^\d+\s*(?:segundos?|minutos?|horas?)$/.test(normalized)
    || IGNORED_LABELS.some((label) => normalized === label || normalized.startsWith(`${label} `));
}

function parseContainerActivity(label: string, detail: string): ParsedWorkoutTask | null {
  const normalizedLabel = normalizeWorkoutText(label);
  if (!["atividade", "cardio", "modalidade"].includes(normalizedLabel)) return null;

  const normalizedDetail = normalizeWorkoutText(detail);
  if (!normalizedDetail || normalizedDetail.includes(" ou ")) return null;
  const aliases = Object.keys(CATALOG_ALIASES)
    .filter((alias) => normalizedDetail.includes(alias))
    .sort((left, right) => right.length - left.length);
  const alias = aliases[0];
  if (!alias) return null;
  const aliasId = CATALOG_ALIASES[alias];
  if (aliases.some((candidate) => candidate.length === alias.length && CATALOG_ALIASES[candidate] !== aliasId)) return null;
  return { sourceExerciseName: alias, prescription: stripMarkdown(detail).trim() };
}

function classifyLabel(label: string): TrainingItemKind {
  const normalized = normalizeWorkoutText(label);
  if (["descanso", "pausa", "recuperacao"].some((value) => normalized === value || normalized.startsWith(`${value} `))) return "rest";
  if (["aquecimento", "preparacao"].some((value) => normalized === value || normalized.startsWith(`${value} `))) return "warmup";
  if (["alongamento", "mobilidade", "liberacao", "desaquecimento"].some((value) => normalized === value || normalized.startsWith(`${value} `))) return "mobility";
  if (["atividade", "cardio", "modalidade"].includes(normalized)) return "activity";
  return "exercise";
}

function prescriptionFields(prescription: string, kind: TrainingItemKind): Pick<ParsedWorkoutItem, "sets" | "reps" | "duration" | "rest" | "notes"> {
  const series = prescription.match(/(\d+)\s+s[eé]ries?\s+de\s+(\d+(?:\s*[-–—]\s*\d+)?)\s+repeti/i);
  const durationMatch = prescription.match(/\b\d+(?:[.,]\d+)?\s*(?:min(?:uto)?s?|seg(?:undo)?s?|h(?:ora)?s?)\b/i);
  const parenthetical = [...prescription.matchAll(/\(([^)]+)\)/g)].map((match) => match[1].trim()).filter(Boolean);
  const residual = durationMatch ? prescription.replace(durationMatch[0], "").replace(/\s+/g, " ").trim() : prescription;
  return {
    sets: series ? Number(series[1]) : null,
    reps: series ? series[2].replace(/[–—]/g, "-").replace(/\s+/g, "") : "",
    duration: durationMatch?.[0] || "",
    rest: kind === "rest" ? prescription : "",
    notes: kind === "rest" ? "" : kind === "exercise" ? parenthetical.join(" ") : residual,
  };
}

function buildParsedItem(line: string): ParsedWorkoutItem | null {
  const withoutPrefix = stripListPrefix(line);
  if (!withoutPrefix || withoutPrefix.startsWith("#")) return null;

  const boldMatch = withoutPrefix.match(/\*\*(.+?)\*\*/);
  if (boldMatch?.index !== undefined) {
    const name = cleanExerciseLabel(boldMatch[1]);
    const detail = stripMarkdown(withoutPrefix.slice(boldMatch.index + boldMatch[0].length))
      .replace(/^\s*[:\-–—]\s*/, "").trim();
    if (!name) return null;
    const kind = classifyLabel(name);
    let sourceExerciseName: string | null = kind === "exercise" ? name : null;
    if (kind === "activity") sourceExerciseName = parseContainerActivity(name, detail)?.sourceExerciseName || null;
    return { name: sourceExerciseName || name, sourceExerciseName, prescription: detail, kind, ...prescriptionFields(detail, kind) };
  }

  const plainLine = stripMarkdown(withoutPrefix);
  const colonIndex = plainLine.indexOf(":");
  if (colonIndex > 0 && colonIndex < 100) {
    const name = cleanExerciseLabel(plainLine.slice(0, colonIndex));
    const prescription = plainLine.slice(colonIndex + 1).trim();
    if (!name) return null;
    const kind = classifyLabel(name);
    return { name, sourceExerciseName: kind === "exercise" ? name : null, prescription, kind, ...prescriptionFields(prescription, kind) };
  }
  return null;
}

export function parseTrainingDay(text: string, weekday: Weekday): TrainingDay {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => line.startsWith("###"));
  const title = heading ? stripMarkdown(heading.replace(/^###\s*/, "")) : `Treino de ${weekday}`;
  const items = lines.filter((line) => !line.startsWith("###")).map(buildParsedItem).filter((item): item is ParsedWorkoutItem => item !== null);
  const message = stripMarkdown(lines.filter((line) => !line.startsWith("###")).join("\n")).slice(0, 5000);
  const isRestDay = items.length === 0 && ["descanso", "off", "lazer"].some((term) => normalizeWorkoutText(message).includes(term));
  return {
    title,
    message,
    isRestDay,
    items: items.map((item, index) => ({
      id: `${normalizeWorkoutText(weekday).replace(/\s+/g, "-")}-${index + 1}`,
      kind: item.kind,
      name: item.name,
      exerciseId: null,
      sets: item.sets,
      reps: item.reps,
      duration: item.duration,
      rest: item.rest,
      notes: item.notes,
      prescription: item.prescription
    }))
  };
}

function buildParsedTask(line: string): ParsedWorkoutTask | null {
  const withoutPrefix = stripListPrefix(line);
  if (!withoutPrefix || withoutPrefix.startsWith("#")) return null;

  const boldMatch = withoutPrefix.match(/\*\*(.+?)\*\*/);
  if (boldMatch?.index !== undefined) {
    const sourceExerciseName = cleanExerciseLabel(boldMatch[1]);
    const detail = stripMarkdown(withoutPrefix.slice(boldMatch.index + boldMatch[0].length))
      .replace(/^\s*[:\-–—]\s*/, "")
      .trim();
    if (!sourceExerciseName) return null;
    if (isIgnoredLabel(sourceExerciseName)) return parseContainerActivity(sourceExerciseName, detail);
    const prescription = detail;
    return { sourceExerciseName, prescription };
  }

  const plainLine = stripMarkdown(withoutPrefix);
  const colonIndex = plainLine.indexOf(":");
  if (colonIndex > 0 && colonIndex < 100) {
    const sourceExerciseName = cleanExerciseLabel(plainLine.slice(0, colonIndex));
    if (sourceExerciseName && !isIgnoredLabel(sourceExerciseName)) {
      return {
        sourceExerciseName,
        prescription: plainLine.slice(colonIndex + 1).trim()
      };
    }
  }

  const separatorMatch = plainLine.match(/\s+[–—-]\s+/);
  if (separatorMatch?.index !== undefined) {
    const sourceExerciseName = plainLine.slice(0, separatorMatch.index).trim();
    if (sourceExerciseName && !isIgnoredLabel(sourceExerciseName)) {
      return {
        sourceExerciseName,
        prescription: plainLine.slice(separatorMatch.index + separatorMatch[0].length).trim()
      };
    }
  }

  return null;
}

export function parseWorkoutDay(text: string, weekday: Weekday): ParsedWorkoutDay {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => line.startsWith("###"));
  const title = heading ? stripMarkdown(heading.replace(/^###\s*/, "")) : `Treino de ${weekday}`;
  const tasks = lines
    .filter((line) => !line.startsWith("###"))
    .map(buildParsedTask)
    .filter((task): task is ParsedWorkoutTask => task !== null);
  const message = stripMarkdown(lines.filter((line) => !line.startsWith("###")).join("\n")).slice(0, 5000);
  const normalizedMessage = normalizeWorkoutText(message);
  const isRestDay = tasks.length === 0 && ["descanso", "off", "lazer"].some((term) => normalizedMessage.includes(term));

  return { title, message, isRestDay, tasks };
}

export function resolveExerciseName(sourceExerciseName: string, exercises: Exercise[]): Exercise | null {
  const normalizedName = normalizeWorkoutText(sourceExerciseName);
  if (!normalizedName) return null;

  const exact = exercises.find((exercise) => {
    return normalizeWorkoutText(exercise.n) === normalizedName || normalizeWorkoutText(exercise.id) === normalizedName;
  });
  if (exact) return exact;

  const aliasedId = CATALOG_ALIASES[normalizedName];
  if (aliasedId) {
    const aliased = exercises.find((exercise) => exercise.id === aliasedId);
    if (aliased) return aliased;
  }

  const aliasMatches = Object.entries(CATALOG_ALIASES)
    .filter(([alias]) => normalizedName.includes(alias) || alias.includes(normalizedName))
    .sort(([left], [right]) => right.length - left.length);
  const longestAlias = aliasMatches[0]?.[1];
  if (longestAlias && aliasMatches.every(([, id]) => id === longestAlias)) {
    const aliased = exercises.find((exercise) => exercise.id === longestAlias);
    if (aliased) return aliased;
  }

  const partialMatches = exercises.filter((exercise) => {
    const normalizedCatalogName = normalizeWorkoutText(exercise.n);
    return normalizedCatalogName.includes(normalizedName) || normalizedName.includes(normalizedCatalogName);
  });
  return partialMatches.length === 1 ? partialMatches[0] : null;
}
