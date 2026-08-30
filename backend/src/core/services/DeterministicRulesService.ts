import { BiomarkerItem } from "../schemas/biomarkers";
import { Profile } from "../schemas/profile";
import { DeterministicAlert } from "../schemas/analysis";

export class DeterministicRulesService {
  static evaluate(biomarkers: BiomarkerItem[], profile: Profile): DeterministicAlert[] {
    const alerts: DeterministicAlert[] = [];

    const getVal = (names: string[]): BiomarkerItem | null => {
      return biomarkers.find(b => 
        names.some(n => b.name.toUpperCase().includes(n.toUpperCase()))
      ) || null;
    };

    const parseNum = (valStr: any): number | null => {
      if (valStr === undefined || valStr === null) return null;
      const num = parseFloat(String(valStr).replace(",", "."));
      return isNaN(num) ? null : num;
    };

    // ==========================================
    // 1. REGRAS BIOQUÍMICAS (DRA. KATIA HARANAKA)
    // ==========================================

    // Vitamina D3
    const vitD = getVal(["VITAMINA D", "25-OH-VITAMINA D", "25-HIDROXI"]);
    if (vitD) {
      const val = parseNum(vitD.value);
      if (val !== null && val < 50) {
        alerts.push({
          biomarker: "Vitamina D3",
          value: val,
          unit: vitD.unit || "ng/mL",
          optimalRange: "50 a 75 ng/mL",
          severity: val < 30 ? "danger" : "warning",
          insight: `Nível de Vitamina D3 subótimo (${val} ng/mL). Dra. Katia Haranaka aponta que níveis < 50 ng/mL comprometem a expressão de mais de 3.000 genes, enfraquecendo a imunidade, síntese hormonal e mantendo inflamação subclínica.`,
          protocol: "Suplementar 5.000 UI a 7.000 UI de D3 formulada com veículo em TCM (triglicerídeos de cadeia média) pela manhã para sincronizar com o pico de cortisol. Adicionar Magnésio e Vitamina K2 (sinergia direcionadora do cálcio aos ossos). Evitar uso noturno.",
          source: "Dra. Katia Haranaka"
        });
      }
    }

    // Vitamina B12
    const vitB12 = getVal(["VITAMINA B12", "COBALAMINA"]);
    if (vitB12) {
      const val = parseNum(vitB12.value);
      if (val !== null && val < 500) {
        alerts.push({
          biomarker: "Vitamina B12",
          value: val,
          unit: vitB12.unit || "pg/mL",
          optimalRange: "> 500 pg/mL",
          severity: val < 350 ? "danger" : "warning",
          insight: `Vitamina B12 subótima (${val} pg/mL). Valores laboratoriais convencionais toleram níveis baixos, mas para proteção neural e prevenção de demências o alvo deve ser > 500. Cerca de 33% da população possui polimorfismo no gene MTRR que impossibilita a conversão da B12 sintética (cianocobalamina).`,
          protocol: "Suplementar diretamente a forma ativa de Metilcobalamina (1000 mcg sublingual ou em cápsula gastrorresistente), contornando polimorfismos da enzima metionina sintase redutase.",
          source: "Dra. Katia Haranaka"
        });
      }
    }

    // Ferritina
    const ferritina = getVal(["FERRITINA"]);
    if (ferritina) {
      const val = parseNum(ferritina.value);
      const isFeminino = profile.sexo === "feminino";
      const thresholdWarning = isFeminino ? 70 : 100;
      const thresholdDanger = isFeminino ? 30 : 50;

      if (val !== null && val < thresholdWarning) {
        alerts.push({
          biomarker: "Ferritina Sérica",
          value: val,
          unit: ferritina.unit || "ng/mL",
          optimalRange: isFeminino ? "70 a 150 ng/mL" : "100 a 250 ng/mL",
          severity: val < thresholdDanger ? "danger" : "warning",
          insight: `Ferritina subótima (${val} ng/mL). A ferritina é cofator da tireoide peroxidase; níveis < 70 ng/mL predispoem ao hipotireoidismo clínico em longo prazo (8-10 anos) e provocam queda de cabelo, fadiga e unhas fracas.`,
          protocol: val < 30
            ? "Ferritina crítica. Indicação médica imediata para protocolo de reposição endovenosa rápida de ferro (ex: Noripurum/Ferinject)."
            : "Suplementar Ferro Quelado (20-40mg) com Vitamina C pela manhã para otimizar a absorção intestinal. Avaliar possíveis sangramentos ou fluxo menstrual abundante.",
          source: "Dra. Katia Haranaka"
        });
      }
    }

    // Homocisteína
    const homocisteina = getVal(["HOMOCISTEÍNA", "HOMOCISTEINA"]);
    if (homocisteina) {
      const val = parseNum(homocisteina.value);
      if (val !== null && val > 7.0) {
        alerts.push({
          biomarker: "Homocisteína",
          value: val,
          unit: homocisteina.unit || "µmol/L",
          optimalRange: "< 7.0 µmol/L",
          severity: val > 12.0 ? "danger" : "warning",
          insight: `Homocisteína elevada (${val} µmol/L). É o maior termômetro da metilação celular. Níveis > 7.0 indicam submetilação, o que envenena o endotélio vascular (risco de infarto e AVC) e acelera o declínio cognitivo.`,
          protocol: "Suplementar cofatores de metilação ativa: Metilcobalamina (1000mcg), Metilfolato (B9 ativa - 800mcg), Piridoxal-5-Fosfato (B6 ativa - 30mg) e TMG (Trimestilglicina/Betaína - 500mg).",
          source: "Dra. Katia Haranaka"
        });
      }
    }

    // PCR-us
    const pcr = getVal(["PROTEÍNA C REATIVA", "PROTEINA C REATIVA", "PCR"]);
    if (pcr) {
      const val = parseNum(pcr.value);
      if (val !== null && val > 0.5) {
        alerts.push({
          biomarker: "Proteína C Reativa Ultra-Sensível",
          value: val,
          unit: pcr.unit || "mg/L",
          optimalRange: "< 0.5 mg/L",
          severity: val > 3.0 ? "danger" : "warning",
          insight: `PCR-us elevada (${val} mg/L). O alvo ótimo para proteção cardiovascular e inflamação celular mínima é < 0.5 mg/L. Níveis entre 1.0 e 3.0 representam risco vascular moderado crônico.`,
          protocol: "Combater inflamação de baixo grau: Dieta anti-inflamatória estrita (zero açúcares refinados e óleos vegetais industriais), suplementação de Ômega-3 (alto EPA/DHA, mínimo 1.5g/dia) e suporte antioxidante com Coenzima Q10.",
          source: "Dra. Katia Haranaka"
        });
      }
    }

    // Glicose de Jejum
    const glicose = getVal(["GLICOSE"]);
    if (glicose) {
      const val = parseNum(glicose.value);
      if (val !== null && val > 85) {
        alerts.push({
          biomarker: "Glicose de Jejum",
          value: val,
          unit: glicose.unit || "mg/dL",
          optimalRange: "70 a 77 mg/dL",
          severity: val > 99 ? "danger" : "warning",
          insight: `Glicose de jejum acima do ideal (${val} mg/dL). Níveis > 85 mg/dL alertam para início de resistência insulínica. O excesso de glicose circulante reage com proteínas formando AGEs (produtos de glicação avançada), uma 'cola plástica' que enrijece artérias e envelhece tecidos.`,
          protocol: "Reduzir carga glicêmica dietética, introduzir fibras solúveis antes das refeições, praticar treinos resistidos (musculação) para captação de glicose via transportador GLUT4 independente de insulina. Avaliar Insulina de Jejum e HOMA-IR.",
          source: "Dra. Katia Haranaka"
        });
      }
    }

    // Creatinina
    const creatinina = getVal(["CREATININA"]);
    if (creatinina) {
      const val = parseNum(creatinina.value);
      if (val !== null && val > 0.9) {
        const hemacias = getVal(["HEMÁCIAS", "HEMACIAS", "ERITRÓCITOS", "ERITROCITE", "ERITRÓCITO", "GLOBULOS VERMELHOS"]);
        const hemaciasVal = hemacias ? parseNum(hemacias.value) : null;
        const pesoVal = parseNum(profile.peso);

        let customProtocol = "Evitar sobrecarga hídrica súbita ou jejum de água prolongado. Monitorar trimestralmente e dosar Cistatina C se necessário.";

        if (hemaciasVal !== null || pesoVal !== null) {
          const lines: string[] = [];
          lines.push("**Protocolo de Hidratação Personalizado da Dra. Katia Haranaka:**");
          
          if (hemaciasVal !== null) {
            const volHemacias = hemaciasVal; // 1 milhão = 1L
            lines.push(`* **Método das Hemácias**: Como você tem **${hemaciasVal} milhões/mm³** de hemácias, sua meta ideal é de **${volHemacias.toFixed(2)} Litros** de água por dia.`);
          }
          
          if (pesoVal !== null) {
            const volPeso = (pesoVal * 40) / 1000;
            lines.push(`* **Método do Peso**: Com base no seu peso de **${pesoVal} kg**, o volume mínimo base é de **${volPeso.toFixed(2)} Litros** (peso × 40ml).`);
          }

          lines.push("* **Instrução de Timing**: Consumir 100% desse volume **até as 16:00h** em copos de 300ml-400ml por hora, evitando sobrecarga noturna.");
          
          customProtocol = lines.join("\n") + "\n\n" + customProtocol;
        }

        alerts.push({
          biomarker: "Creatinina Sérica",
          value: val,
          unit: creatinina.unit || "mg/dL",
          optimalRange: "0.7 a 0.9 mg/dL",
          severity: val > 1.2 ? "danger" : "warning",
          insight: `Creatinina elevada (${val} mg/dL) para fins de longevidade. A faixa de laboratório tolera até 1.25, mas para proteção renal ao longo do envelhecimento, valores acima de 1.0 sugerem início de declínio da filtração glomerular ou desidratação crônica.`,
          protocol: customProtocol,
          source: "Dra. Katia Haranaka"
        });
      }
    }

    // Colesterol: Relação Triglicerídeos / HDL
    const tg = getVal(["TRIGLICERÍDEOS", "TRIGLICERIDEOS"]);
    const hdl = getVal(["COLESTEROL HDL", "HDL"]);
    if (tg && hdl) {
      const tgVal = parseNum(tg.value);
      const hdlVal = parseNum(hdl.value);
      if (tgVal !== null && hdlVal !== null && hdlVal > 0) {
        const ratio = tgVal / hdlVal;
        if (ratio > 2.0) {
          alerts.push({
            biomarker: "Relação Triglicerídeos / HDL",
            value: parseFloat(ratio.toFixed(2)),
            unit: "proporção",
            optimalRange: "< 2.0",
            severity: ratio > 3.5 ? "danger" : "warning",
            insight: `Relação TG/HDL elevada (${ratio.toFixed(2)}). Este índice é um preditor fortíssimo de resistência insulínica e presença de partículas de LDL pequenas e densas (aterogênicas). HDL alto com triglicerídeos baixos é sinônimo de saúde cardiovascular.`,
            protocol: "Reduzir drasticamente açúcares, álcool e carboidratos refinados (que elevam triglicerídeos hepáticos). Realizar exercícios aeróbios na Zona 2 para aumentar transporte reverso de colesterol via HDL.",
            source: "Dra. Katia Haranaka"
          });
        }
      }
    }

    // Tireoide (TSH)
    const tsh = getVal(["TSH"]);
    if (tsh) {
      const val = parseNum(tsh.value);
      if (val !== null && (val > 2.0 || val < 0.4)) {
        alerts.push({
          biomarker: "TSH (Hormônio Estimulante da Tireoide)",
          value: val,
          unit: tsh.unit || "µUI/mL",
          optimalRange: "1.0 a 2.0 µUI/mL",
          severity: (val > 4.5 || val < 0.4) ? "danger" : "warning",
          insight: `TSH fora da faixa ótima (${val} µUI/mL). Faixas ideais de longevidade miram entre 1.0 e 2.0. TSH > 2.0 indica início de hipotireoidismo subclínico. Competidores halógenos (flúor, cloro, bromo) na rotina diária ocupam o transportador NIS, impedindo a entrada de iodo na tireoide.`,
          protocol: "Dosar painel completo (TSH, T4 Livre, T3 Livre e T3 Reverso). Suplementar cofatores essenciais: Iodo Metilado/Lugol, Selênio, Zinco e Tirosina. Eliminar pastas com flúor e pães industriais com bromo.",
          source: "Dra. Katia Haranaka"
        });
      }
    }

    // Carga Aterogênica / ApoB & não-HDL (Diretriz Brasileira de Dislipidemias de 2025)
    const triglicerideos = getVal(["TRIGLICERÍDEOS", "TRIGLICERIDEOS"]);
    if (triglicerideos) {
      const tgVal = parseNum(triglicerideos.value);
      if (tgVal !== null && tgVal > 150) {
        const ldl = getVal(["COLESTEROL LDL", "LDL"]);
        const naoHdl = getVal(["COLESTEROL NÃO HDL", "NAO HDL", "COLESTEROL NAO HDL"]);
        const apoB = getVal(["APOLIPOPROTEÍNA B", "APOB"]);
        
        const ldlVal = ldl ? parseNum(ldl.value) : null;
        const naoHdlVal = naoHdl ? parseNum(naoHdl.value) : null;
        const apoBVal = apoB ? parseNum(apoB.value) : null;
        
        if (ldlVal !== null || naoHdlVal !== null || apoBVal !== null) {
          alerts.push({
            biomarker: "Perfil Aterogênico (Triglicerídeos > 150 mg/dL)",
            value: tgVal,
            unit: "mg/dL",
            optimalRange: "Triglicerídeos < 150 mg/dL",
            severity: "warning",
            insight: `Triglicerídeos elevados (${tgVal} mg/dL) com perfil lipídico aterogênico. A Diretriz Brasileira de Dislipidemias (2025) aponta que quando os triglicérides estão acima de 150 mg/dL, o cálculo convencional do LDL pode ser impreciso. Nesses casos, o não-HDL (valor obtido: ${naoHdlVal ?? '--'} mg/dL) e o ApoB (valor obtido: ${apoBVal ?? '--'} mg/dL) são recomendados como marcadores auxiliares primordiais de alta utilidade para avaliação real do número de partículas aterogênicas circulantes.`,
            protocol: "Otimizar ingestão de gorduras saudáveis, eliminar carboidratos simples, praticar exercícios aeróbicos regulares. Se ApoB estiver elevado, focar na redução de partículas aterogênicas sob orientação clínica.",
            source: "Diretriz Brasileira de Dislipidemias (2025)"
          });
        }
      }
    }

    // ==========================================
    // 2. REGRAS DE PERFORMANCE E TREINO (DR. GUILHERME FRECCIA)
    // ==========================================

    // VO2 Máximo
    const vo2Max = parseNum(profile.perfVo2Max);
    if (vo2Max !== null) {
      const isMasc = profile.sexo === "masculino";
      const thresholdWarning = isMasc ? 40 : 35;
      const thresholdDanger = isMasc ? 30 : 27;

      if (vo2Max < thresholdWarning) {
        alerts.push({
          biomarker: "VO2 Máximo (Capacidade Aeróbia)",
          value: vo2Max,
          unit: "ml/kg/min",
          optimalRange: isMasc ? "> 45 ml/kg/min" : "> 40 ml/kg/min",
          severity: vo2Max < thresholdDanger ? "danger" : "warning",
          insight: `Capacidade aeróbia baixa (${vo2Max} ml/kg/min). O Dr. Guilherme Freccia ressalta que o VO2 máx é o preditor de mortalidade por todas as causas mais forte que existe. Cada 1 MET (~3.5 ml/kg/min) de melhora reduz em 7% a mortalidade geral. Níveis < ${thresholdDanger} indicam fragilidade cardiorrespiratória grave.`,
          protocol: "Iniciar treinamento híbrido: 80% do volume semanal na Zona 2 (aeróbio estável, conversação fácil) para aumento de densidade mitocondrial e 20% em treinos HIIT de alta intensidade para elevar o teto cardiovascular. Combinar com treinos de força resistida.",
          source: "Dr. Guilherme Freccia"
        });
      }
    }

    // Força Manual / Sarcopenia
    const forca = parseNum(profile.perfForcaPreensao);
    if (forca !== null) {
      const isMasc = profile.sexo === "masculino";
      const thresholdWarning = isMasc ? 35 : 25;
      const thresholdDanger = isMasc ? 30 : 20;

      if (forca < thresholdWarning) {
        alerts.push({
          biomarker: "Força de Preensão Manual (Dinamometria)",
          value: forca,
          unit: "kgf",
          optimalRange: isMasc ? "> 40 kgf" : "> 28 kgf",
          severity: forca < thresholdDanger ? "danger" : "warning",
          insight: `Força muscular abaixo da média de longevidade (${forca} kgf). Dinamometria baixa é o marcador clínico padrão de sarcopenia (perda de massa muscular e qualidade das fibras). Menor força se correlaciona com maior fragilidade, quedas e menor expectativa de vida ativa.`,
          protocol: "Periodização focada em hipertrofia e força máxima. Exercícios multiarticulares (agachamento, levantamento terra, supino) executados de 2 a 3 vezes por semana, focando em progressão de carga e consumo de 1.6g a 2.0g de proteína por kg de peso corporal ao dia.",
          source: "Dr. Guilherme Freccia"
        });
      }
    }

    // Teste Sentar-Levantar
    const sentar = parseNum(profile.perfSentarLevantar);
    if (sentar !== null && sentar > 10.0) {
      alerts.push({
        biomarker: "Teste Sentar e Levantar (Mobilidade / Força de Pernas)",
        value: sentar,
        unit: "segundos",
        optimalRange: "< 10.0 s",
        severity: sentar > 15.0 ? "danger" : "warning",
        insight: `Tempo elevado no teste sentar-levantar de 5 repetições (${sentar}s). Indica perda de força em membros inferiores, potência muscular explosiva e instabilidade de equilíbrio nas articulações (joelhos e quadris).`,
        protocol: "Fortalecimento de membros inferiores com foco em extensão de joelho e quadril (leg press, cadeira extensora e agachamento goblet). Incluir treinos de potência muscular (subida de degrau rápida) e alongamentos de cadeia posterior.",
        source: "Dr. Guilherme Freccia"
      });
    }

    // Pressão Arterial
    const sistolica = parseNum(profile.cardioSistolica);
    const diastolica = parseNum(profile.cardioDiastolica);
    if (sistolica !== null && diastolica !== null) {
      if (sistolica > 130 || diastolica > 85) {
        const isDanger = sistolica > 140 || diastolica > 90;
        alerts.push({
          biomarker: "Pressão Arterial",
          value: `${sistolica}/${diastolica}`,
          unit: "mmHg",
          optimalRange: "< 120/80 mmHg",
          severity: isDanger ? "danger" : "warning",
          insight: `Pressão arterial limítrofe ou elevada (${sistolica}/${diastolica} mmHg). A hipertensão sobrecarrega o endotélio vascular e induz fibrose cardíaca. Está intimamente correlacionada com a resistência insulínica sistêmica e enrijecimento de artérias.`,
          protocol: "Evitar o consumo de sal refinado industrial; preferir sais naturais em moderação. Implementar treinamento aeróbio consistente (reduz a resistência vascular periférica). Suplementar Magnésio Quelado (300-400mg) para induzir vasodilatação endotelial e óxido nítrico.",
          source: "Dr. Guilherme Freccia / Dra. Katia Haranaka"
        });
      }
    }

    // ==========================================
    // 3. REGRAS DE NUTRIÇÃO E ESTILO DE VIDA (NUTRIÇÃO)
    // ==========================================

    // Qualidade do Sono
    const sonoQualidade = parseNum(profile.sonoQualidade);
    if (sonoQualidade !== null && sonoQualidade < 7) {
      alerts.push({
        biomarker: "Qualidade do Sono",
        value: sonoQualidade,
        unit: "escala 1-10",
        optimalRange: ">= 7/10",
        severity: sonoQualidade < 5 ? "danger" : "warning",
        insight: `Qualidade de sono subótima (${sonoQualidade}/10). O sono inadequado impede a restauração mitocondrial cerebral e eleva cronicamente o cortisol matinal, gerando picos de glicose e desejo aumentado por carboidratos simples durante o dia.`,
          protocol: "Implementar higiene do sono rígida: Bloquear luz azul artificial 2 horas antes de dormir, jantar no máximo até as 20h, consumir magnésio inositol (200mg) e chá de camomila/mulungu 1 hora antes de deitar. Evitar telas na cama.",
          source: "Dra. Katia Haranaka / Nutrição"
      });
    }

    return alerts;
  }
}
