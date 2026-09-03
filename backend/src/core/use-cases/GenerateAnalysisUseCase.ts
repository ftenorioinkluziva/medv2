import { LLMServicePort } from "../ports/LLMServicePort";
import { DatabasePort } from "../ports/DatabasePort";
import { Result } from "../types/Result";
import { Analysis, AnalysisLLMResponseSchema, AnalysisSchema } from "../schemas/analysis";
import { BiomarkerItem } from "../schemas/biomarkers";
import { DeterministicRulesService } from "../services/DeterministicRulesService";
import { KnowledgeBasePort } from "../ports/KnowledgeBasePort";
import { RuntimePort } from "../ports/RuntimePort";
import { Profile } from "../schemas/profile";
import { toOperationError } from "../types/errors";
import { AnalysisConfigurationPort } from "../ports/ConfigurationPort";
import { ResolveTrainingPlanUseCase } from "./ResolveTrainingPlanUseCase";

export class GenerateAnalysisUseCase {
  constructor(
    private llmService: LLMServicePort,
    private db: DatabasePort,
    private configuration: AnalysisConfigurationPort,
    private knowledgeBase: KnowledgeBasePort,
    private runtime: RuntimePort,
    private readonly trainingPlanResolver?: ResolveTrainingPlanUseCase
  ) {}

  private async retrieveRelevantKbCards(biomarkers: BiomarkerItem[], profile: Profile): Promise<string> {
    let retrievedText = "";
    const cleanStr = (s: string) => {
      if (!s) return "";
      return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    const activeKeywords: string[] = [];
    biomarkers.forEach(b => {
      const cleanName = cleanStr(b.name);
      activeKeywords.push(...cleanName.split(/\s+/).filter(w => w.length > 2));
    });

    if (profile.objetivos) {
      activeKeywords.push(...cleanStr(profile.objetivos).split(/\s+/).filter(w => w.length > 3));
    }
    if (profile.limitacoesFisicas) {
      activeKeywords.push(...cleanStr(profile.limitacoesFisicas).split(/\s+/).filter(w => w.length > 3));
    }

    // Termos comuns
    activeKeywords.push("suplementacao", "vitamina", "mineral", "treino", "exercicio");

    const matchedCards: any[] = [];
    const maxCardsPerKb = 4;

    const knowledgeBases = await this.knowledgeBase.getKnowledgeBases();
    knowledgeBases.forEach(kb => {
        const cards = kb.cards;
        let kbMatches = 0;

        for (const card of cards) {
          if (kbMatches >= maxCardsPerKb) break;

          let score = 0;
          const cardText = cleanStr(`${card.title || card.name || ""} ${card.tags.join(" ")} ${card.tldr || ""}`);

          for (const kw of activeKeywords) {
            if (cardText.includes(kw)) {
              score += 1;
            }
          }

          if (score > 0) {
            matchedCards.push({ card, score, source: kb.name });
            kbMatches++;
          }
        }
    });

    // Ordenar por score e formatar
    matchedCards.sort((a, b) => b.score - a.score);
    
    retrievedText = matchedCards.map(m => {
      const c = m.card;
      return `=== CARTÃO DE CONHECIMENTO (${c.type || "conteúdo"}): ${c.name || c.title || "Sem título"} (Fonte: ${c.category || "Clínica"}) ===\nTags: ${c.tags.join(", ")}\nResumo: ${c.tldr || ""}\n\nDetalhamento:\n${c.rawText || ""}\n===================================`;
    }).join("\n\n");

    return retrievedText;
  }

  private mergeDeterministicSupplements(
    llmSupplements: any[],
    alerts: any[]
  ): any[] {
    const merged = [...llmSupplements];

    alerts.forEach(alert => {
      let detSupp: any = null;

      if (alert.biomarker === "Vitamina D3") {
        detSupp = {
          name: "Vitamina D3 em TCM + K2-MK7",
          purpose: "Absorção otimizada de D3 com TCM matinal associada à K2 para direcionar o cálcio aos ossos, evitando calcificação arterial, conforme diretrizes da Dra. Katia Haranaka.",
          dose: alert.value < 30 ? "7.000 UI D3 + 120 mcg K2" : "5.000 UI D3 + 120 mcg K2",
          frequency: "Pela manhã, logo após o café da manhã (cortisol matinal)"
        };
      } else if (alert.biomarker === "Vitamina B12") {
        detSupp = {
          name: "Metilcobalamina (B12 Ativa)",
          purpose: "Forma bioativa da B12 para contornar polimorfismo genético MTRR (33% da população), essencial para neuroproteção e metilação.",
          dose: "1.000 mcg",
          frequency: "Sublingual pela manhã"
        };
      } else if (alert.biomarker === "Ferritina Sérica") {
        if (alert.value >= 30) {
          detSupp = {
            name: "Ferro Bisglicinato Quelado + Vitamina C",
            purpose: "Reposição de ferro elementar quelado para restaurar os estoques de ferritina essenciais para a saúde capilar e tireoidiana.",
            dose: "30 mg de Ferro + 500 mg de Vitamina C",
            frequency: "Pela manhã, em jejum"
          };
        }
      } else if (alert.biomarker === "Homocisteína") {
        detSupp = {
          name: "Pool de Metilação Ativa (B6 + B9 + B12 + TMG)",
          purpose: "Fornecer doadores de metil ativos para otimizar o ciclo de metilação, reduzir os níveis de homocisteína e proteger o endotélio vascular.",
          dose: "Metilfolato 800mcg + P-5-P 30mg + Metilcobalamina 1000mcg + Trimestilglicina 500mg",
          frequency: "Pela manhã, antes do almoço"
        };
      } else if (alert.biomarker === "Proteína C Reativa Ultra-Sensível") {
        detSupp = {
          name: "Ômega-3 (Alto EPA/DHA)",
          purpose: "Reduzir inflamação de baixo grau e combater a inflamação endotelial subclínica (PCR-us elevado).",
          dose: "2.000 mg (mínimo 1.200 mg EPA/DHA)",
          frequency: "Com as principais refeições"
        };
      } else if (alert.biomarker === "TSH (Hormônio Estimulante da Tireoide)") {
        detSupp = {
          name: "Pool de Cofatores Tireoidianos (Zinco + Selênio + Tirosina + Lugol)",
          purpose: "Fornecer minerais e aminoácidos essenciais como cofatores para síntese hormonal e evitar a competição com os halógenos (flúor, cloro, bromo).",
          dose: "Zinco 25mg + Selênio 100mcg + L-Tirosina 500mg + Iodo Quelado/Lugol 150mcg",
          frequency: "Pela manhã"
        };
      } else if (alert.biomarker === "Pressão Arterial") {
        detSupp = {
          name: "Magnésio Quelado (Bisglicinato)",
          purpose: "Promover vasodilatação e relaxamento vascular periférico para auxiliar no controle da pressão arterial.",
          dose: "350 mg",
          frequency: "À noite, antes de dormir"
        };
      } else if (alert.biomarker === "Qualidade do Sono") {
        detSupp = {
          name: "Magnésio Inositol + L-Teanina",
          purpose: "Induzir relaxamento do sistema nervoso central, modular GABA e diminuir cortisol noturno para melhor qualidade de sono.",
          dose: "Mag Inositol 250mg + L-Teanina 200mg",
          frequency: "1 hora antes de dormir"
        };
      }

      if (detSupp) {
        // Encontrar índice existente com verificação robusta e normalizada
        const idx = merged.findIndex(s => {
          const sName = s.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const sNorm = sName.replace(/[^a-z0-9]/g, "");
          const dNorm = detSupp.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

          // Check direct inclusions
          if (sNorm.includes(dNorm) || dNorm.includes(sNorm)) return true;

          // Biomarker shortcuts checks
          if (dNorm.includes("omega3") && sNorm.includes("omega3")) return true;
          if ((dNorm.includes("d3") || dNorm.includes("colecalciferol")) && (sNorm.includes("d3") || sNorm.includes("colecalciferol") || sNorm.includes("vitaminad"))) return true;
          if ((dNorm.includes("b12") || dNorm.includes("cobalamina")) && (sNorm.includes("b12") || sNorm.includes("cobalamina") || sNorm.includes("vitaminab12"))) return true;
          if (dNorm.includes("ferro") && sNorm.includes("ferro")) return true;
          if (dNorm.includes("magnesio") && sNorm.includes("magnesio")) {
            // Distinguish Magnesium Inositol from normal Bisglicinate/Glicinate
            const sHasInositol = sNorm.includes("inositol");
            const dHasInositol = dNorm.includes("inositol");
            return sHasInositol === dHasInositol;
          }
          if ((dNorm.includes("tireoide") || dNorm.includes("tsh") || dNorm.includes("tirosina")) && 
              (sNorm.includes("tireoide") || sNorm.includes("tsh") || sNorm.includes("tirosina") || sNorm.includes("selenio"))) return true;

          return false;
        });

        if (idx !== -1) {
          // Sobrescreve para alinhar com as regras estritas da clínica
          merged[idx] = {
            ...merged[idx],
            name: detSupp.name,
            purpose: detSupp.purpose,
            dose: detSupp.dose,
            frequency: detSupp.frequency
          };
        } else {
          // Adiciona à lista
          merged.push(detSupp);
        }
      }
    });

    // Remove duplicates from LLM generation that matching script didn't clean up
    const finalMerged: any[] = [];
    const seen = new Set<string>();

    merged.forEach(s => {
      const sName = s.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const sNorm = sName.replace(/[^a-z0-9]/g, "");
      
      let key = sNorm;
      if (sNorm.includes("omega3")) key = "omega3";
      else if (sNorm.includes("vitaminad") || sNorm.includes("d3")) key = "d3";
      else if (sNorm.includes("vitaminab12") || sNorm.includes("b12")) key = "b12";
      else if (sNorm.includes("ferro")) key = "ferro";
      else if (sNorm.includes("magnesio") && sNorm.includes("inositol")) key = "maginositol";
      else if (sNorm.includes("magnesio")) key = "magnesio";
      else if (sNorm.includes("tsh") || sNorm.includes("tirosina") || sNorm.includes("tireoide") || sNorm.includes("selenio")) key = "tireoide";

      if (!seen.has(key)) {
        seen.add(key);
        finalMerged.push(s);
      }
    });

    return finalMerged;
  }

  async execute(
    userId: string,
    biomarkers: BiomarkerItem[],
    bloodTestDate: string | null,
    bloodTestFilename: string
  ): Promise<Result<Analysis>> {
    try {
      const profile = await this.db.getProfile(userId);
      const settings = await this.configuration.getAnalysisConfiguration(userId);
      const model = settings.modelAnalysis;
      const lens = settings.lens || "longevidade";

      let lensInstructions = "";
      if (lens === "longevidade") {
        lensInstructions = settings.lensLongevidade || `Você deve adotar a Lente de Otimização e Longevidade (Biohacking).
Não se limite a analisar as faixas de referência padrão dos laboratórios clínicos. Compare os resultados com as faixas ideais/ótimas voltadas para longevidade e alto rendimento biológico.
Por exemplo: HOMA-IR ideal < 1.5, Ferritina ótima ~100 ng/mL, HDL ideal > 50 mg/dL, Triglicerídeos/HDL ideal < 2.0.
Destaque no diagnóstico se o paciente está fora dessas faixas otimizadas e prescreva suplementações e treinos voltados para otimização metabólica fina e envelhecimento saudável.`;
      } else if (lens === "performance") {
        lensInstructions = settings.lensPerformance || `Você deve adotar a Lente de Performance Esportiva.
Foque as recomendações de nutrição, treino e suplementação para maximizar o ganho de massa muscular magra, aumento de força física, melhora do VO2 máx e aceleração da recuperação muscular pós-treino.
Interprete os biomarcadores sob a ótica de otimização de performance física para atletas ou praticantes de atividade física intensa.`;
      } else {
        lensInstructions = settings.lensConvencional || `Você deve adotar a Lente da Medicina Convencional.
Analise os resultados do exame e bioimpedância estritamente sob os limites de referência habituais dos laboratórios clínicos.
Foque na identificação de patologias clássicas instaladas, carências nutricionais clínicas graves e disfunções orgânicas óbvias, recomendando ações preventivas tradicionais baseadas em consensos médicos.`;
      }

      // 1. Executa regras determinísticas locais
      const deterministicAlerts = DeterministicRulesService.evaluate(biomarkers, profile);

      // 2. Recupera cartões contextuais das bases de conhecimento do Drive
      const kbContext = await this.retrieveRelevantKbCards(biomarkers, profile);

      const systemPrompt = `Você é um médico integrativo, nutricionista esportivo e treinador de elite.
Sua tarefa é analisar os dados do perfil de um paciente, suas métricas corporais (bioimpedância) e seus biomarcadores sanguíneos.
Você deve retornar um plano de saúde completo contendo:
1. Estado de Saúde: Resumo clínico do estado de saúde, destacando desvios importantes, deficiências ou fatores limitantes (ex: resistência insulínica, perfil lipídico desfavorável, deficiência de vitaminas).
2. Plano de Suplementação: Lista de suplementos direcionados para otimizar os biomarcadores e o estado geral do paciente.
3. Plano Alimentar: Diretrizes alimentares detalhadas, contendo sugestões de refeições adaptadas às restrições e hábitos do paciente.
4. Plano de Treino: Rotina de exercícios que respeite as limitações físicas (ex: dor em articulações) e potencialize as metas.

DIRETRIZ FILOSÓFICA DA ANÁLISE:
${lensInstructions}

=== DIRETRIZES DA BASE DE CONHECIMENTO CLÍNICO ===
Abaixo estão as diretrizes de referência reais da clínica extraídas das bases de conhecimento (Dra. Katia Haranaka, Guilherme Freccia e Nutrição). Você deve seguir ESTREITAMENTE estas regras nas suas análises de saúde, planos alimentares, de treino e de suplementação. Não recomende dosagens nem use faixas de referência fora destas especificações:

${kbContext}

=== REGRAS DE INTEGRAÇÃO CLÍNICA ===
- Se a Ferritina estiver baixa (<70), destaque a necessidade de ferro e investigue o fluxo menstrual se for mulher.
- Se a Vitamina D3 estiver <50, prescreva Vitamina D3 com veículo em TCM (triglicerídeos de cadeia média) para tomar pela manhã com cofatores Magnésio e K2.
- Se a Vitamina B12 estiver <500, recomende Metilcobalamina e explique que cianocobalamina não é ideal para 33% da população (polimorfismo MTRR).
- Se a Glicose estiver >85, recomende musculação/treino resistido para sensibilizar os receptores GLUT4 e alertar sobre AGEs (glicação).
- Siga as diretrizes de treino aeróbio (Zona 2 e HIIT) de Guilherme Freccia para melhorar o VO2 máx e combater a sarcopenia.
- Sempre sugira suplementos na forma quelada (ex: magnésio bisglicinato, zinco picolinato) e em cápsulas gastrorresistentes, conforme as diretrizes de Nutrição.`;

      const prompt = `Por favor, realize a análise de saúde com base nos seguintes dados coletados:

=== PERFIL DO PACIENTE & HÁBITOS ===
- Idade: ${profile.idade} anos
- Sexo: ${profile.sexo}
- Altura: ${profile.altura} cm
- Peso: ${profile.peso} kg
- IMC: ${profile.imc} (${profile.peso && profile.altura ? this.getImcClassification(profile.imc) : 'Não especificado'})
- Massa Magra (Músculo): ${profile.massaMagra} kg
- InBody Score: ${profile.inbodyScore}/100
- Pressão Arterial: ${profile.cardioSistolica}/${profile.cardioDiastolica} mmHg
- FC Repouso: ${profile.cardioFcRepouso} bpm
- Objetivos: ${profile.objetivos}
- Histórico Familiar: ${profile.historicoFamiliar}
- Observações: ${profile.observacoes}
- Condições Médicas: ${profile.condicoesMedicas}
- Medicamentos em uso: ${profile.medicamentos}
- Alergias: ${profile.alergias}
- Cirurgias: ${profile.cirurgias}
- Horas de Sono: ${profile.sonoHoras}h (Qualidade: ${profile.sonoQualidade}/10, Regularidade: ${profile.sonoRegularidade}, Problemas: ${profile.sonoProblemas})
- Hábitos: Água/dia: ${profile.aguaDia}L, Estresse: ${profile.nivelEstresse}/10, Tabagismo: ${profile.tabagismo}
- Dieta Atual: ${profile.dietaAtual}
- Gestão de Estresse: ${profile.gestaoEstresse}
- Suplementação Atual: ${profile.suplementacaoAtual}
- Cronobiologia: 1ª Exp. Solar: ${profile.cronoExposicaoSolar}, Última Refeição: ${profile.cronoUltimaRefeicao}, Luz Art. Início: ${profile.cronoLuzArtInicio}, Luz Art. Fim: ${profile.cronoLuzArtFim}, Obs: ${profile.cronoObsLuz}
- Testes Funcionais: Força preensão: ${profile.perfForcaPreensao} kgf, Sentar-levantar: ${profile.perfSentarLevantar}s, VO2 máx: ${profile.perfVo2Max}, Tolerância CO2: ${profile.perfToleranciaCo2}s
- Limitações Físicas: ${profile.limitacoesFisicas}

=== ANAMNESE NUTRICIONAL (DIETA & DIGESTÃO) ===
- Tipo de Dieta: ${(profile as any).dietType || 'Não especificado'}
- Frequência / Padrão Alimentar: ${(profile as any).eatingPattern || 'Não especificado'}
- Meta de Proteína Autodeclarada: ${(profile as any).proteinIntake || 'Não especificado'}
- Ingestão Diária de Líquidos: ${(profile as any).fluidIntake || 'Não especificado'}
- Restrições Alimentares: ${(profile as any).dietaryRestrictions || 'Nenhuma'}
- Consumo de Álcool: ${(profile as any).alcoholConsumption || 'Não especificado'}
- Consumo de Cafeína: ${(profile as any).caffeineIntake || 'Não especificado'} (Último consumo: ${(profile as any).latestCaffeineTime || 'Não especificado'})
- Mudanças Recentes na Dieta (últimos 3 meses): ${(profile as any).recentDietChanges || 'Nenhuma'}
- Refeições Típicas Atuais: ${(profile as any).typicalMeals || 'Não especificado'}
- Notas Alimentares Adicionais: ${(profile as any).dietaryNotes || 'Nenhuma'}

=== SAÚDE DIGESTIVA ===
- Frequência de Evacuação: ${(profile as any).bowelFrequency || 'Não especificado'}
- Consistência das Fezes: ${(profile as any).stoolConsistency || 'Não especificado'}
- Sintomas de Desconforto:
  - Estufamento (Bloating): ${(profile as any).bloating || 'Não especificado'}
  - Gases: ${(profile as any).gas || 'Não especificado'}
  - Refluxo Ácido: ${(profile as any).acidReflux || 'Não especificado'}
  - Arrotos (Burping): ${(profile as any).burping || 'Não especificado'}
  - Náusea: ${(profile as any).nausea || 'Não especificado'}
  - Dor Abdominal: ${(profile as any).abdominalPain || 'Não especificado'}
- Apetite: ${(profile as any).appetite || 'Não especificado'}
- Sensibilidades Alimentares Conhecidas: ${(profile as any).foodSensitivities || 'Nenhuma'}

=== ANAMNESE DE EXERCÍCIO (ATIVIDADE FÍSICA) ===
- Frequência de Treino: ${(profile as any).exerciseFrequency || 'Não especificada'}
- Tipos de Exercício Praticados: ${(profile as any).exerciseTypes || 'Nenhum'}
- Intensidade de Esforço: ${(profile as any).exerciseIntensity || 'Não especificada'}
- Duração Típica da Sessão: ${(profile as any).typicalSessionDuration || 'Não especificada'}
- Movimentação Diária Padrão: ${(profile as any).dailyMovement || 'Não especificada'}
- Contexto de Massa Muscular: ${(profile as any).muscleContext || 'Não especificado'}
- Limitações e Desafios de Recuperação: ${(profile as any).limitationsAndRecovery || 'Nenhum'}
- Notas e Histórico de Atividade: ${(profile as any).exerciseNotes || 'Nenhuma'}

=== EXAME DE SANGUE (BIOMARCADORES) ===
Data do Exame: ${bloodTestDate || 'Não informada'}
Arquivo: ${bloodTestFilename || 'Não informado'}
Biomarcadores Extraídos:
${JSON.stringify(biomarkers, null, 2)}

=== INSTRUÇÕES ===
Gere um JSON estruturado contendo a análise clínica. O JSON deve possuir exatamente os seguintes campos:
1. "healthStatus": String em formato Markdown resumindo clinicamente o estado de saúde do paciente. Use parágrafos limpos e estruturados, negritos (**texto**) para destacar biomarcadores alterados ou desvios-chave, e tópicos com marcadores (* item) se apropriado para tornar a leitura dinâmica, escaneável e clara.
2. "supplementation": Uma lista de objetos. Cada objeto deve representar um suplemento e conter:
   - "name": Nome do suplemento (ex: "Zinco Quelado", "Selênio", "Coenzima Q10").
   - "purpose": Descrição/Justificativa médica simplificada e direta explicando em que isso ajuda o paciente de acordo com os exames dele.
   - "dose": Dosagem recomendada (ex: "25 mg", "100 mcg").
   - "frequency": Frequência recomendada (ex: "Com refeição", "Antes de dormir", "Pela manhã").
3. "nutritionPlan": Um objeto contendo exatamente 7 chaves ("Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"). O valor de cada chave deve ser uma lista (array) de objetos representando as refeições sugeridas para aquele dia. Cada objeto de refeição deve conter exatamente os seguintes campos:
   - "name": Nome da refeição (ex: "Café da Manhã", "Almoço", "Lanche da Tarde", "Jantar", "Ceia").
   - "time": Horário sugerido no formato HH:MM (ex: "07:30", "12:30", "19:00").
   - "description": Descrição detalhada dos alimentos sugeridos com suas respectivas porções/pesos em gramas (ex: "150g de peito de frango grelhado, 150g de arroz integral cozido, salada de alface e tomate com 1 colher de sopa de azeite de oliva").
   - "proteinGrams": Quantidade estimada de proteína da refeição em gramas (número).
   - "fatGrams": Quantidade estimada de gordura da refeição em gramas (número).
   - "carbsGrams": Quantidade estimada de carboidrato da refeição em gramas (número).

   CRITICAL NUTRITION PLAN RULES:
   - As refeições sugeridas devem conter exclusivamente alimentos e produtos comuns e de fácil acesso no Brasil (como ovos, arroz, feijão, frango, carne magra, batata doce, mandioca, aveia, banana, mamão, azeite, iogurte natural, queijos simples). Evite ingredientes exóticos, importados ou muito caros.
   - Adapte o plano de acordo com as restrições alimentares do paciente, alergias, sensibilidades alimentares conhecidas e sintomas digestivos (ex: se o paciente relata gases ou estufamento moderado a severo, evite ou reduza alimentos altamente fermentativos ou que piorem os sintomas relatados).
4. "trainingPlan": Um objeto contendo exatamente 7 chaves ("Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"). O valor de cada chave deve ser uma string em formato Markdown contendo o treino programado para aquele dia (se for dia de descanso, escreva detalhadamente sobre o descanso, alongamento ou cardio regenerativo).

5. "trainingPlanIntent": O mesmo plano de treino em estrutura editável. Para cada item do tipo "exercise" ou "activity", informe "searchText" com o nome mais específico possível em português ou inglês, e opcionalmente "aliases", "bodyPart", "target" e "equipment". Nunca invente "exerciseId": o backend resolverá o item pelo catálogo local. Para "warmup", "mobility" e "rest", mantenha "searchText" vazio. Cada item também deve conter "id", "kind", "name", "sets", "reps", "duration", "rest", "notes" e "prescription". Se não houver correspondência única e segura no catálogo, o item será mantido para revisão profissional.

   CRITICAL TRAINING PLAN RULES:
   - Respeite rigorosamente as limitações físicas (${profile.limitacoesFisicas}) e lesões/desafios de recuperação informados pelo paciente (${(profile as any).limitationsAndRecovery}).
   - Adapte a rotina de treinos de acordo com a frequência semanal (${(profile as any).exerciseFrequency || 'Não especificada'}), tipos de exercícios praticados (${(profile as any).exerciseTypes || 'Nenhum'}), intensidade tolerável (${(profile as any).exerciseIntensity || 'Não especificada'}), duração típica da sessão (${(profile as any).typicalSessionDuration || 'Não especificada'}) e notas de histórico de atividade (${(profile as any).exerciseNotes || 'Nenhuma'}).
   - Se o paciente tem dores crônicas ou limitações de mobilidade importantes, proponha exercícios adaptados e seguros de fortalecimento e poupe as articulações afetadas.
   - Integre as diretrizes da base de conhecimento clínico de Guilherme Freccia para VO2 máx, zonas de treino (Zona 2 e HIIT) e prevenção de sarcopenia.
6. "nutritionOrientation": String em formato Markdown contendo um resumo analítico do estado de saúde e orientações nutricionais gerais sob a ótica da Dra. Katia Haranaka e da base de Nutrição (acidez, absorção de minerais quelados, impacto da glicação, etc.).
7. "trainingOrientation": String em formato Markdown contendo um resumo analítico da aptidão física e orientações de treinamento gerais sob a ótica do Dr. Guilherme Freccia (melhora do VO2 máx, prevenção de sarcopenia, zonas de treino, etc.).

Formato de saída estrito:
{
  "healthStatus": "...",
  "supplementation": [
    {
      "name": "...",
      "purpose": "...",
      "dose": "...",
      "frequency": "..."
    }
  ],
  "nutritionPlan": {
    "Segunda-feira": [
      {
        "name": "Café da Manhã",
        "time": "07:30",
        "description": "3 ovos mexidos feitos no azeite, 50g de tapioca e 100g de mamão formosa",
        "proteinGrams": 24,
        "fatGrams": 18,
        "carbsGrams": 30
      }
    ],
    "Terça-feira": [],
    "Quarta-feira": [],
    "Quinta-feira": [],
    "Sexta-feira": [],
    "Sábado": [],
    "Domingo": []
  },
  "trainingPlan": {
    "Segunda-feira": "### Treino A: Membros Superiores...",
    "Terça-feira": "### Treino B: Pernas...",
    "Quarta-feira": "Descanso Ativo...",
    "Quinta-feira": "...",
    "Sexta-feira": "...",
    "Sábado": "...",
    "Domingo": "..."
  },
  "trainingPlanIntent": {
    "Segunda-feira": {
      "title": "Treino A",
      "message": "",
      "isRestDay": false,
      "items": [{
        "id": "segunda-feira-1",
        "kind": "exercise",
        "name": "Supino reto com halteres",
        "searchText": "Supino reto com halteres",
        "aliases": ["dumbbell bench press"],
        "bodyPart": "chest",
        "target": "pectorals",
        "equipment": "dumbbell",
        "sets": 4,
        "reps": "10-12",
        "duration": "",
        "rest": "90 segundos",
        "notes": "Controle a fase excêntrica.",
        "prescription": "4 séries de 10-12 repetições"
      }]
    },
    "Terça-feira": { "title": "Descanso", "message": "", "isRestDay": true, "items": [] },
    "Quarta-feira": { "title": "Descanso", "message": "", "isRestDay": true, "items": [] },
    "Quinta-feira": { "title": "Descanso", "message": "", "isRestDay": true, "items": [] },
    "Sexta-feira": { "title": "Descanso", "message": "", "isRestDay": true, "items": [] },
    "Sábado": { "title": "Descanso", "message": "", "isRestDay": true, "items": [] },
    "Domingo": { "title": "Descanso", "message": "", "isRestDay": true, "items": [] }
  },
  "nutritionOrientation": "...",
  "trainingOrientation": "..."
}

Responda APENAS com o JSON válido, sem comentários ou explicações.`;

      const rawResult = await this.llmService.call({
        prompt,
        systemPrompt,
        model,
        responseJson: true
      });

      const parsed = AnalysisLLMResponseSchema.safeParse(rawResult);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "INVALID_LLM_OUTPUT",
            category: "upstream",
            message: "O modelo retornou dados estruturados em formato inválido para a análise clínica.",
            retryable: true,
            hint: parsed.error.message
          }
        };
      }

      const finalAnalysis: Analysis = AnalysisSchema.parse({
        id: this.runtime.createId("anl"),
        date: bloodTestDate || this.runtime.now().toISOString().split("T")[0],
        bloodTestFilename: bloodTestFilename,
        biomarkers: biomarkers,
        healthStatus: parsed.data.healthStatus || "Análise gerada com sucesso.",
        supplementation: this.mergeDeterministicSupplements(parsed.data.supplementation || [], deterministicAlerts),
        nutritionPlan: parsed.data.nutritionPlan,
        trainingPlan: parsed.data.trainingPlan,
        trainingPlanStructured: this.trainingPlanResolver
          ? await this.trainingPlanResolver.execute({
            trainingPlan: parsed.data.trainingPlan,
            trainingPlanIntent: parsed.data.trainingPlanIntent
          })
          : null,
        deterministicAlerts: deterministicAlerts,
        nutritionOrientation: parsed.data.nutritionOrientation || "",
        trainingOrientation: parsed.data.trainingOrientation || "",
        createdAt: this.runtime.now().toISOString(),
        annotations: ""
      });

      return { ok: true, value: finalAnalysis };
    } catch (err: any) {
      return {
        ok: false,
        error: toOperationError(err, {
          code: "ANALYSIS_FAILED",
          category: "internal",
          message: "Falha na geração de análise pela LLM.",
          retryable: false
        })
      };
    }
  }

  private getImcClassification(imc: number): string {
    if (imc < 18.5) return "Abaixo do peso";
    if (imc < 25) return "Peso normal";
    if (imc < 30) return "Sobrepeso";
    if (imc < 35) return "Obesidade Grau I";
    if (imc < 40) return "Obesidade Grau II";
    return "Obesidade Grau III";
  }
}
