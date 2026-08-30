import { JsonDatabaseAdapter } from "../backend/src/adapters/database/JsonDatabaseAdapter";
import { DeterministicRulesService } from "../backend/src/core/services/DeterministicRulesService";

function mergeDeterministicSupplements(llmSupplements: any[], alerts: any[]): any[] {
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
      const idx = merged.findIndex(s => {
        const sName = s.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const sNorm = sName.replace(/[^a-z0-9]/g, "");
        const dNorm = detSupp.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

        if (sNorm.includes(dNorm) || dNorm.includes(sNorm)) return true;

        if (dNorm.includes("omega3") && sNorm.includes("omega3")) return true;
        if ((dNorm.includes("d3") || dNorm.includes("colecalciferol")) && (sNorm.includes("d3") || sNorm.includes("colecalciferol") || sNorm.includes("vitaminad"))) return true;
        if ((dNorm.includes("b12") || dNorm.includes("cobalamina")) && (sNorm.includes("b12") || sNorm.includes("cobalamina") || sNorm.includes("vitaminab12"))) return true;
        if (dNorm.includes("ferro") && sNorm.includes("ferro")) return true;
        if (dNorm.includes("magnesio") && sNorm.includes("magnesio")) {
          const sHasInositol = sNorm.includes("inositol");
          const dHasInositol = dNorm.includes("inositol");
          return sHasInositol === dHasInositol;
        }
        if ((dNorm.includes("tireoide") || dNorm.includes("tsh") || dNorm.includes("tirosina")) && 
            (sNorm.includes("tireoide") || sNorm.includes("tsh") || sNorm.includes("tirosina") || sNorm.includes("selenio"))) return true;

        return false;
      });

      if (idx !== -1) {
        merged[idx] = {
          ...merged[idx],
          name: detSupp.name,
          purpose: detSupp.purpose,
          dose: detSupp.dose,
          frequency: detSupp.frequency
        };
      } else {
        merged.push(detSupp);
      }
    }
  });

  // Remove potential duplicates from LLM generation that matching script didn't clean up (e.g. if the LLM outputted two omega-3s, etc.)
  // Let's filter duplicates
  const finalMerged: any[] = [];
  const seen = new Set<string>();

  merged.forEach(s => {
    const sName = s.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const sNorm = sName.replace(/[^a-z0-9]/g, "");
    
    // Normalizations for deduplication check
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
    } else {
      console.log(`Deduplicated redundant/overlapping entry: ${s.name}`);
    }
  });

  return finalMerged;
}

async function main() {
  const db = new JsonDatabaseAdapter();
  const profile = await db.getProfile();
  const analyses = await db.getAnalyses();

  if (analyses.length === 0) {
    console.log("No analyses found to update.");
    return;
  }

  console.log(`Found ${analyses.length} analyses. Recomputing alerts and aligning supplements with refined matching...`);

  for (const analysis of analyses) {
    const alerts = DeterministicRulesService.evaluate(analysis.biomarkers || [], profile);
    analysis.deterministicAlerts = alerts;
    analysis.supplementation = mergeDeterministicSupplements(analysis.supplementation || [], alerts);
    console.log(`Analysis dated ${analysis.date} updated with ${alerts.length} alerts & aligned supplements.`);
  }

  await db.saveAnalyses(analyses);
  console.log("Successfully saved updated analyses database.");
}

main().catch(console.error);
