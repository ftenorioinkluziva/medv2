import { DatabasePort } from "../ports/DatabasePort";
import { Result } from "../types/Result";
import { RuntimePort } from "../ports/RuntimePort";
import { toOperationError } from "../types/errors";
import { WorkoutContract, WorkoutContractSchema } from "../schemas/handoff";

const WEEKDAY_MAP: Record<string, string> = {
  "Segunda-feira": "monday",
  "Terça-feira": "tuesday",
  "Quarta-feira": "wednesday",
  "Quinta-feira": "thursday",
  "Sexta-feira": "friday",
  "Sábado": "saturday",
  "Domingo": "sunday"
};

export const DETERMINISTIC_ALIASES: Record<string, string> = {
  "supino com halteres": "0289", // dumbbell bench press
  "supino reto com halteres": "0289", 
  "supino reto": "0025", // barbell bench press
  "supino inclinado": "0301", // dumbbell incline bench press
  "supino reto barra": "0025",
  "remada curvada": "0027", // barbell bent over row
  "remada curvada com barra": "0027",
  "desenvolvimento militar": "1457", // barbell standing military press
  "desenvolvimento de ombros com halteres": "0405", // dumbbell seated shoulder press
  "desenvolvimento de ombros com halteres sentado": "0405",
  "desenvolvimento de ombros": "0405",
  "puxada alta": "0197", // cable lat pulldown
  "puxador frontal": "0197",
  "puxada frontal": "0197",
  "barra fixa": "0652", // pull-up
  "puxador frontal na polia": "0197",
  "agachamento bulgaro": "2368", // dumbbell bulgarian split squat
  "flexoes": "0662", // push-up
  "flexao de braco": "0662",
  "flexao de braco pushups": "0662",
  "push ups": "0662",
  "push up": "0662",
  "remada cavalinho": "0606", // t-bar row
  "prancha": "0464", // plank
  "prancha frontal": "0464",
  "agachamento livre": "0043", // barbell squat
  "agachamento goblet": "1760", // dumbbell goblet squat
  "agachamento": "0043",
  "levantamento terra": "0032", // barbell deadlift
  "leg press 45": "0739", // sled 45 leg press
  "leg press 45 graus": "0739",
  "leg press": "0739",
  "cadeira extensora": "0585", // lever leg extension
  "cadeira flexora": "0599", // lever seated leg curl
  "caminhada corrida": "0685", // treadmill walk
  "caminhada": "0685",
  "corrida": "0685",
  "ciclismo": "2138", // stationary bicycle
  "bicicleta ergometrica": "0003", // air bike / stationary bike
  "bicicleta": "0003",
  "hiit": "0003",
  "triceps na polia": "0201", // cable pushdown
  "triceps na polia alta": "0201",
  "triceps corda": "0200", 
  "triceps pulley com corda": "0200", // cable rope pushdown
  "triceps com corda": "0200", 
  "elevacao lateral com halteres": "0334", // dumbbell lateral raise
  "elevacao lateral": "0334",
  "remada com halteres": "0292", // dumbbell row
  "remada unilateral com halter serrote": "0292",
  "remada unilateral": "0292",
  "serrote": "0292",
  "rosca direta": "0294", // barbell curl
  "rosca direta com barra": "0294",
  "rosca direta com barra w": "0447", // ez barbell curl
  "levantamento terra romeno": "0085", // barbell romanian deadlift
  "levantamento terra romeno com halteres": "1459", // dumbbell romanian deadlift
  "elevacao pelvica": "1409", // barbell glute bridge / hip thrust
  "hip thrust": "1409",
  "panturrilha em pe": "0108", // standing calf raise
  "crucifixo inverso": "0329", // dumbbell rear lateral raise
  "crucifixo inverso na maquina": "0602", // lever seated reverse fly
  "crucifixo inverso na maquina ou com halteres": "0602",
  "cadeira abdutora": "0597", // lever seated hip abduction
  "afundo com halteres": "0410", // dumbbell lunge
  "afundo": "0410",
  "sprint": "0685", // treadmill walk/run or general cardio
  "recuperacao": "0685",
  "cardio lazer": "0685",
  "lazer": "0685",
  "caminhada ao ar livre": "0685",
  "ciclismo de lazer": "2138"
};

export class MapWorkoutContractUseCase {
  constructor(
    private db: DatabasePort,
    private runtime: RuntimePort
  ) {}

  private cleanString(s: string): string {
    return s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async execute(contractId: string, subject: string, userId: string): Promise<Result<WorkoutContract>> {
    try {
      const profile = await this.db.getProfile(userId);
      const analyses = await this.db.getAnalyses(userId);

      if (analyses.length === 0) {
        return {
          ok: false,
          error: {
            code: "NO_ANALYSIS_FOUND",
            category: "validation",
            message: "Nenhuma análise clínica encontrada para gerar o plano de treino.",
            retryable: false
          }
        };
      }

      const latestAnalysis = analyses.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const trainingPlan = latestAnalysis.trainingPlan as Record<string, string>;

      const sessions: any[] = [];
      const mappingHistory: any[] = [];
      let sessionOrder = 1;

      for (const key of Object.keys(WEEKDAY_MAP)) {
        const dayText = trainingPlan[key];
        if (!dayText || dayText.trim().length === 0) continue;

        const day = WEEKDAY_MAP[key];
        const lines = dayText.split("\n");

        let items: any[] = [];
        let warmup: any = null;
        let cooldown: any = null;
        let exerciseOrder = 1;
        let sessionTitle = `Treino de ${key}`;
        const titleLine = lines.find(l => l.trim().startsWith("###"));
        if (titleLine) {
          sessionTitle = titleLine.trim().replace(/^###\s*/, "").trim();
        }

        // Verifica se é descanso
        const isRestDay = !dayText.includes("**") && (
          dayText.toLowerCase().includes("descanso") || 
          dayText.toLowerCase().includes("lazer") || 
          dayText.toLowerCase().includes("off")
        );

        if (isRestDay) continue;

        // Determina se é uma sessão de cardio/HIIT pura
        const isCardioSession = (
          sessionTitle.toLowerCase().includes("cardio") || 
          sessionTitle.toLowerCase().includes("hiit") || 
          sessionTitle.toLowerCase().includes("aerobico") || 
          sessionTitle.toLowerCase().includes("corrida") || 
          sessionTitle.toLowerCase().includes("caminhada") || 
          sessionTitle.toLowerCase().includes("recuperacao") ||
          sessionTitle.toLowerCase().includes("descanso ativo")
        ) && !(
          sessionTitle.toLowerCase().includes("treino a") || 
          sessionTitle.toLowerCase().includes("treino b") || 
          sessionTitle.toLowerCase().includes("treino c") || 
          sessionTitle.toLowerCase().includes("treino d")
        );

        if (isCardioSession) {
          // --- PARSER ESPECIALIZADO DE CARDIO ---
          const cardioOptions = [
            { keys: ["bicicleta ergometrica", "spinning", "bike", "bicicleta", "spinning"], id: "2138", name: "Stationary Bicycle" },
            { keys: ["eliptico", "transport"], id: "2141", name: "Elliptical Trainer" },
            { keys: ["esteira", "caminhada", "corrida", "caminhada ao ar livre"], id: "0685", name: "Treadmill Walk" },
            { keys: ["remo"], id: "0663", name: "Rowing Machine" },
            { keys: ["natacao"], id: "2144", name: "Swimming" },
          ];

          const detectedActivities: Array<{ id: string; name: string; duration: number; notes: string[] }> = [];

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("###")) continue;

            const cleanLine = trimmed
              .replace(/^([\*\-\+]\s+|\d+[\.\)]\s+)/, "")
              .replace(/\*\*/g, "")
              .trim();
            const cleanLineLower = cleanLine.toLowerCase();

            // Mapeia aquecimento
            if (cleanLineLower.includes("aquecimento") || cleanLineLower.includes("aquecer")) {
              let notes = cleanLine;
              const colonIdx = cleanLine.indexOf(":");
              if (colonIdx !== -1) notes = cleanLine.substring(colonIdx + 1).trim();
              
              let durationSeconds = 300;
              const minMatch = cleanLineLower.match(/(\d+)\s*(?:min|minuto|minutos)/i);
              if (minMatch) {
                durationSeconds = parseInt(minMatch[1], 10) * 60;
              }
              warmup = { durationSeconds, notes };
              continue;
            }

            // Mapeia desaquecimento
            if (cleanLineLower.includes("desaquecimento")) {
              let notes = cleanLine;
              const colonIdx = cleanLine.indexOf(":");
              if (colonIdx !== -1) notes = cleanLine.substring(colonIdx + 1).trim();
              
              let durationSeconds = 300;
              const minMatch = cleanLineLower.match(/(\d+)\s*(?:min|minuto|minutos)/i);
              if (minMatch) {
                durationSeconds = parseInt(minMatch[1], 10) * 60;
              }
              cooldown = { durationSeconds, notes };
              continue;
            }

            // Ignora mobilidade/alongamento puro dos exercícios, mas anexa ao cooldown
            if (cleanLineLower.includes("mobilidade") || cleanLineLower.includes("foam roller") || cleanLineLower.includes("rolo de espuma") || cleanLineLower.includes("alongamento")) {
              const notesToAdd = cleanLine;
              if (!cooldown) {
                cooldown = { durationSeconds: 600, notes: notesToAdd };
              } else {
                cooldown.notes = cooldown.notes + " | " + notesToAdd;
              }
              continue;
            }

            // Tenta detectar modalidade com base na palavra-chave que aparece primeiro na frase
            let matchedActivity: any = null;
            let firstIndex = Infinity;
            for (const opt of cardioOptions) {
              for (const k of opt.keys) {
                const idx = cleanLineLower.indexOf(k);
                if (idx !== -1 && idx < firstIndex) {
                  firstIndex = idx;
                  matchedActivity = opt;
                }
              }
            }

            if (matchedActivity) {
              let duration = 600; // default 10 min
              const minMatch = cleanLineLower.match(/(\d+)\s*(?:a\s*(\d+))?\s*(?:min|minuto|minutos)/i);
              if (minMatch) {
                const val1 = parseInt(minMatch[1], 10);
                const val2 = minMatch[2] ? parseInt(minMatch[2], 10) : null;
                duration = val2 ? Math.round((val1 + val2) / 2) * 60 : val1 * 60;
              }

              detectedActivities.push({
                id: matchedActivity.id,
                name: matchedActivity.name,
                duration,
                notes: [cleanLine]
              });
            } else {
              // Se for uma linha descritiva de protocolo/intensidade e já temos uma atividade detectada,
              // anexa à última atividade detectada.
              if (detectedActivities.length > 0) {
                const lastAct = detectedActivities[detectedActivities.length - 1];
                lastAct.notes.push(cleanLine);

                // Procura por tempo na linha de nota para atualizar a duração se for maior/mais específica
                const minMatch = cleanLineLower.match(/(\d+)\s*(?:a\s*(\d+))?\s*(?:min|minuto|minutos)/i);
                if (minMatch) {
                  const val1 = parseInt(minMatch[1], 10);
                  const val2 = minMatch[2] ? parseInt(minMatch[2], 10) : null;
                  const duration = val2 ? Math.round((val1 + val2) / 2) * 60 : val1 * 60;
                  if (duration > lastAct.duration) {
                    lastAct.duration = duration;
                  }
                }
              }
            }
          }

          // Cria os items a partir das atividades detectadas
          for (const act of detectedActivities) {
            const cleanNotes = act.notes.filter(n => 
              !n.toLowerCase().startsWith("modalidade") && 
              !n.toLowerCase().startsWith("duracao") && 
              !n.toLowerCase().startsWith("duração")
            );

            items.push({
              sourceExerciseName: act.name,
              openGymExerciseId: act.id,
              mappingMethod: "curated-alias",
              mappingJustification: "Processado pelo parser especializado de cardio",
              mappingConfidence: 1.0,
              order: exerciseOrder++,
              sets: 1,
              reps: null,
              repsScheme: null,
              load: { value: null, unit: "kg", instruction: null },
              notes: cleanNotes,
              restrictions: [],
              alerts: [],
              durationSeconds: act.duration,
              restSeconds: 90
            });
          }
        } else {
          for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Extrai Título
          if (trimmed.startsWith("###")) {
            sessionTitle = trimmed.replace(/^###\s*/, "").trim();
            continue;
          }

          // Extrai Desaquecimento / Cardio pós-treino
          if (
            trimmed.toLowerCase().includes("cardio pos-treino") ||
            trimmed.toLowerCase().includes("cardio pós-treino") ||
            trimmed.toLowerCase().includes("desaquecimento") ||
            trimmed.toLowerCase().includes("cardio de recuperacao") ||
            trimmed.toLowerCase().includes("cardio de recuperação")
          ) {
            let notes = trimmed;
            const colonIdx = trimmed.indexOf(":");
            if (colonIdx !== -1) {
              notes = trimmed.substring(colonIdx + 1).trim();
            }
            notes = notes.replace(/^([\*\-\+]\s+|\d+[\.\)]\s+)/, "").replace(/\*\*/g, "").trim();
            let durationSeconds: number | null = null;
            const minMatch = trimmed.match(/(\d+)\s*(?:min|minuto|minutos)/i);
            if (minMatch) {
              durationSeconds = parseInt(minMatch[1], 10) * 60;
            }
            cooldown = { durationSeconds, notes };
            continue;
          }

          // Extrai Aquecimento
          if (trimmed.toLowerCase().includes("aquecimento") || trimmed.toLowerCase().includes("aquecer")) {
            let notes = trimmed;
            const colonIdx = trimmed.indexOf(":");
            if (colonIdx !== -1) {
              notes = trimmed.substring(colonIdx + 1).trim();
            }
            notes = notes.replace(/^([\*\-\+]\s+|\d+[\.\)]\s+)/, "").replace(/\*\*/g, "").trim();
            let durationSeconds: number | null = null;
            const minMatch = trimmed.match(/(\d+)\s*(?:min|minuto|minutos)/i);
            if (minMatch) {
              durationSeconds = parseInt(minMatch[1], 10) * 60;
            }
            warmup = { durationSeconds, notes };
            continue;
          }

          // Extrai Exercício
          const boldMatch = trimmed.match(/\*\*(.*?)\*\*/);
          let candidateName = "";
          if (boldMatch) {
            candidateName = boldMatch[1];
          } else {
            const colonIdx = trimmed.indexOf(":");
            if (colonIdx !== -1 && trimmed.substring(0, colonIdx).split(/\s+/).length <= 5) {
              candidateName = trimmed.substring(0, colonIdx).replace(/^[\*\-\d\.\s]+/, "").trim();
            }
          }

          if (candidateName) {
            // Limpa o nome do exercício
            const cleanName = this.cleanString(candidateName);

            // Ignorar termos comuns de metadados que não são exercícios
            const ignoredKeywords = ["atividade", "duracao", "opcoes", "objetivo", "foco", "protocolo", "modalidade", "descanso", "pausa", "observacao", "observacoes", "nota", "notas"];
            if (ignoredKeywords.some(kw => cleanName.startsWith(kw))) {
              continue;
            }

            // Mapeamento Determinístico
            let resolvedId = "";
            let matchedAlias = "";

            if (DETERMINISTIC_ALIASES[cleanName]) {
              resolvedId = DETERMINISTIC_ALIASES[cleanName];
              matchedAlias = cleanName;
            } else {
              // Procura por substring
              for (const alias of Object.keys(DETERMINISTIC_ALIASES)) {
                if (cleanName.includes(alias) || alias.includes(cleanName)) {
                  resolvedId = DETERMINISTIC_ALIASES[alias];
                  matchedAlias = alias;
                  break;
                }
              }
            }

            // Fallback de matching determinístico inteligente se não encontrado na tabela
            if (!resolvedId) {
              if (cleanName.includes("abdominal") || cleanName.includes("prancha")) {
                resolvedId = "0464"; // plank
                matchedAlias = "fallback abdominal -> prancha";
              } else if (
                cleanName.includes("cardio") || 
                cleanName.includes("caminhada") || 
                cleanName.includes("corrida") || 
                cleanName.includes("esteira") ||
                cleanName.includes("sprint") ||
                cleanName.includes("recuperacao") ||
                cleanName.includes("lazer") ||
                cleanName.includes("bike") ||
                cleanName.includes("bicicleta") ||
                cleanName.includes("ciclismo") ||
                cleanName.includes("transport")
              ) {
                resolvedId = "0685"; // treadmill walk
                matchedAlias = "fallback cardio";
              } else if (cleanName.includes("triceps")) {
                resolvedId = "0201"; // cable pushdown
                matchedAlias = "fallback triceps -> polia";
              } else if (cleanName.includes("biceps") || cleanName.includes("rosca")) {
                resolvedId = "0294"; // dumbbell curl
                matchedAlias = "fallback biceps -> rosca";
              } else if (cleanName.includes("agachamento")) {
                resolvedId = "0043"; // agachamento livre
                matchedAlias = "fallback agachamento";
              } else {
                resolvedId = "0662"; // push-up (generic fallback)
                matchedAlias = "generic fallback -> push-up";
              }
            }

            // Detecta se é um exercício de cardio
            const isCardioExercise = [
              "cardio", "caminhada", "corrida", "ciclismo", "hiit", "sprint", 
              "recuperacao", "esteira", "bike", "bicicleta", "transport", 
              "remo", "natacao", "eliptico", "lazer"
            ].some(word => cleanName.includes(word));

            // Extrai Séries
            let sets = 3;
            const setsMatch = trimmed.match(/(\d+)\s*(?:series|séries|sér|ser|s(?![a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]))/i);
            if (setsMatch) {
              sets = parseInt(setsMatch[1], 10);
            }

            // Extrai Repetições e Duração
            let reps: any = 10;
            let repsScheme: string | null = null;
            let durationSeconds: number | null = null;

            if (isCardioExercise) {
              reps = null;
              // Procura duração em minutos
              const minMatch = trimmed.match(/(\d+)\s*(?:min|minuto|minutos)/i);
              if (minMatch) {
                durationSeconds = parseInt(minMatch[1], 10) * 60;
              } else {
                durationSeconds = 600; // default 10 min se não especificado
              }
            } else {
              // Exercício de força / holds
              if (trimmed.toLowerCase().includes("falha") || trimmed.toLowerCase().includes("amrap")) {
                reps = null;
                repsScheme = "AMRAP";
              } else {
                const rangeMatch = trimmed.match(/(\d+)\s*[-a]\s*(\d+)\s*(?:repeticoes|repetições|reps|rep|segundos|seg|s(?![a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]))/i);
                if (rangeMatch) {
                  reps = { min: parseInt(rangeMatch[1], 10), max: parseInt(rangeMatch[2], 10) };
                } else {
                  const singleMatch = trimmed.match(/(\d+)\s*(?:repeticoes|repetições|reps|rep|segundos|seg|s(?![a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]))/i);
                  if (singleMatch) {
                    reps = parseInt(singleMatch[1], 10);
                  }
                }
              }
            }

            // Extrai Descanso
            let restSeconds = 90;
            const restMatch = trimmed.match(/(\d+)\s*(?:s(?![a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ])|seg|segundos)/i);
            if (restMatch) {
              restSeconds = parseInt(restMatch[1], 10);
            }

            // Extrai Carga/Instrução
            let loadInstruction: string | null = null;
            if (trimmed.toLowerCase().includes("progressiva")) {
              loadInstruction = "carga progressiva";
            } else if (trimmed.toLowerCase().includes("moderada")) {
              loadInstruction = "carga moderada";
            } else if (trimmed.toLowerCase().includes("leve")) {
              loadInstruction = "carga leve";
            }

            // Extrai notas/orientações adicionais
            const notes: string[] = [];
            const notesMatch = trimmed.match(/\((.*?)\)/);
            if (notesMatch) {
              notes.push(notesMatch[1].replace(/\*\*/g, "").trim());
            }

            const item = {
              sourceExerciseName: candidateName,
              openGymExerciseId: resolvedId,
              mappingMethod: "curated-alias" as const,
              mappingJustification: `Mapeamento determinístico via chave '${matchedAlias}'`,
              mappingConfidence: resolvedId.startsWith("0662") && !cleanName.includes("flexao") ? 0.5 : 1.0,
              order: exerciseOrder++,
              sets,
              reps,
              repsScheme,
              load: { value: null, unit: "kg", instruction: loadInstruction },
              notes,
              restrictions: [],
              alerts: [],
              durationSeconds,
              restSeconds
            };

            items.push(item);

            mappingHistory.push({
              sourceExerciseName: candidateName,
              openGymExerciseId: resolvedId,
              method: "curated-alias",
              justification: `Mapeamento determinístico via chave '${matchedAlias}'`,
              confidence: item.mappingConfidence
            });
          }
        }
      }

        if (items.length > 0) {
          sessions.push({
            day,
            type: (
              sessionTitle.toLowerCase().includes("cardio") || 
              sessionTitle.toLowerCase().includes("hiit") || 
              sessionTitle.toLowerCase().includes("aerobico") || 
              sessionTitle.toLowerCase().includes("corrida") || 
              sessionTitle.toLowerCase().includes("caminhada") || 
              sessionTitle.toLowerCase().includes("recuperacao") ||
              sessionTitle.toLowerCase().includes("descanso ativo")
            ) && !(
              sessionTitle.toLowerCase().includes("treino a") || 
              sessionTitle.toLowerCase().includes("treino b") || 
              sessionTitle.toLowerCase().includes("treino c") || 
              sessionTitle.toLowerCase().includes("treino d")
            ) ? "cardio" : "strength",
            title: sessionTitle,
            order: sessionOrder++,
            warmup: warmup || { durationSeconds: null, notes: null },
            cooldown: cooldown || { durationSeconds: null, notes: null },
            items
          });
        }
      }

      const issuedAt = this.runtime.now().toISOString();
      const expiresAt = new Date(this.runtime.now().getTime() + 24 * 60 * 60 * 1000).toISOString();

      const contract = {
        contractVersion: "medv0-opengym-workout/v1",
        contractId: contractId,
        source: "medv0",
        issuedAt,
        expiresAt,
        clinicalAnalysis: {
          agentName: "Medicina do Exercício",
          analysisId: latestAnalysis.id,
          livingAnalysisVersionId: latestAnalysis.id,
          analysisVersion: 1,
          status: "completed"
        },
        prescription: {
          objective: profile.objetivos || "Hipertrofia e Condicionamento",
          restrictions: profile.limitacoesFisicas ? [profile.limitacoesFisicas] : [],
          alerts: [],
          progression: [],
          sessions
        },
        catalog: {
          provider: "opengym",
          version: "1.2.2"
        },
        audit: {
          mappingHistory,
          sourceProductId: latestAnalysis.id
        }
      };

      return { ok: true, value: WorkoutContractSchema.parse(contract) };
    } catch (err: any) {
      return {
        ok: false,
        error: toOperationError(err, {
          code: "MAPPING_EXECUTION_ERROR",
          category: "internal",
          message: "Erro durante o processamento do contrato.",
          retryable: false
        })
      };
    }
  }
}
