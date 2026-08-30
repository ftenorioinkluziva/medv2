import { BiomarkerItem } from "../schemas/biomarkers";

export function normalizeBiomarkerName(name: string): string {
  if (!name) return "";
  
  // Clean quotes, double spaces, and trim
  let clean = name.trim()
    .toUpperCase()
    .replace(/["']/g, '') // remove quotes
    .replace(/\s+/g, ' '); // collapse spaces
  
  // Strip accents for mapping comparison
  const stripAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const strippedClean = stripAccents(clean);
  
  // Synonym Map
  const synonymMap: Record<string, string> = {
    'LIPOPROTEINA A': 'LIPOPROTEÍNA A',
    'LIPOPROTEINA(A)': 'LIPOPROTEÍNA A',
    'SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)': 'SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)',
    'SULFATO DE DEHIDROEPIANDROSTERONA(SDHEA)': 'SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)',
    'DHEA-S': 'SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)',
    'SDHEA': 'SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)',
    'DHEAS': 'SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)',
    'LPA': 'LIPOPROTEÍNA A',
    'LP(A)': 'LIPOPROTEÍNA A',
    'TRIGLICERIDEOS': 'TRIGLICERÍDEOS',
    'HDL': 'COLESTEROL HDL',
    'LDL': 'COLESTEROL LDL',
    'COLESTEROL HDL': 'COLESTEROL HDL',
    'COLESTEROL LDL': 'COLESTEROL LDL',
    'COLESTEROL-HDL': 'COLESTEROL HDL',
    'COLESTEROL-LDL': 'COLESTEROL LDL',
    'COLESTEROL NÃO HDL': 'COLESTEROL NÃO HDL',
    'COLESTEROL NAO HDL': 'COLESTEROL NÃO HDL',
    'COLESTEROL NAO-HDL': 'COLESTEROL NÃO HDL',
    'COLESTEROL NÃO-HDL': 'COLESTEROL NÃO HDL',
    'NAO HDL': 'COLESTEROL NÃO HDL',
    'NAO-HDL': 'COLESTEROL NÃO HDL',
    'NÃO-HDL': 'COLESTEROL NÃO HDL',
    'APOLIPOPROTEINA B': 'APOLIPOPROTEÍNA B',
    'APOB': 'APOLIPOPROTEÍNA B',
    'APOLIPOPROTEINA A1': 'APOLIPOPROTEÍNA A1',
    'APOA1': 'APOLIPOPROTEÍNA A1',
    'ESTIMATIVA DA TAXA DE FILTRACAO GLOMERULAR': 'FILTRAÇÃO GLOMERULAR ESTIMADA',
    'ESTIMATIVA DA TAXA DE FILTRAÇÃO GLOMERULAR': 'FILTRAÇÃO GLOMERULAR ESTIMADA',
    'TAXA DE FILTRACAO GLOMERULAR': 'FILTRAÇÃO GLOMERULAR ESTIMADA',
    'TAXA DE FILTRAÇÃO GLOMERULAR': 'FILTRAÇÃO GLOMERULAR ESTIMADA',
    'FILTRACAO GLOMERULAR': 'FILTRAÇÃO GLOMERULAR ESTIMADA',
    'FILTRAÇÃO GLOMERULAR': 'FILTRAÇÃO GLOMERULAR ESTIMADA',
    'EGFR': 'FILTRAÇÃO GLOMERULAR ESTIMADA',
    'FILTRAÇÃO GLOMERULAR ESTIMADA': 'FILTRAÇÃO GLOMERULAR ESTIMADA',
    'CALCIO IONICO': 'CÁLCIO IÔNICO',
    'CALCIO IONICO/LIVRE': 'CÁLCIO IÔNICO',
    'CALCIO LIVRE': 'CÁLCIO IÔNICO',
    'CALCIO IONICO LIVRE': 'CÁLCIO IÔNICO',
    'CÁLCIO IÔNICO/LIVRE': 'CÁLCIO IÔNICO',
    'CÁLCIO IÔNICO': 'CÁLCIO IÔNICO',
    'PSA TOTAL': 'PSA TOTAL',
    'ANTIGENO PROSTATICO ESPECIFICO TOTAL': 'PSA TOTAL',
    'ANTIGENO PROSTATICO ESPECIFICO': 'PSA TOTAL',
    'PSA LIVRE': 'PSA LIVRE',
    'ANTIGENO PROSTATICO ESPECIFICO LIVRE': 'PSA LIVRE',
    'DHT': 'DHT',
    'DIIDROTESTOSTERONA': 'DHT',
    'DI-HIDROTESTOSTERONA': 'DHT',
    'CORTISOL': 'CORTISOL (08 HORAS)',
    'CORTISOL 08 HORAS': 'CORTISOL (08 HORAS)',
    'CORTISOL BASAL': 'CORTISOL (08 HORAS)',
    'CORTISOL MATUTINO': 'CORTISOL (08 HORAS)',
    'CORTISOL 8H': 'CORTISOL (08 HORAS)',
    'CORTISOL DAS 8H': 'CORTISOL (08 HORAS)',
    'CORTISOL 8 HORAS': 'CORTISOL (08 HORAS)',
    'CORTISOL (08 HORAS)': 'CORTISOL (08 HORAS)',
    'GLICEMIA': 'GLICOSE',
    'GLICOSE': 'GLICOSE',
    'GLICOSE DE JEJUM': 'GLICOSE',
    'INSULINA': 'INSULINA',
    'INSULINA BASAL': 'INSULINA',
    'INSULINA DE JEJUM': 'INSULINA',
    'HEMOGLOBINA GLICOSILADA': 'HEMOGLOBINA GLICADA',
    'HEMOGLOBINA GLICADA (HBA1C)': 'HEMOGLOBINA GLICADA',
    'HBA1C': 'HEMOGLOBINA GLICADA',
    'HEMOGLOBINA GLICADA': 'HEMOGLOBINA GLICADA',
    'HEMOGLOBINA GLICADA - HBA1C': 'HEMOGLOBINA GLICADA',
    'GLICEMIA MEDIA ESTIMADA': 'GLICEMIA MÉDIA ESTIMADA',
    'GLICEMIA MÉDIA ESTIMADA': 'GLICEMIA MÉDIA ESTIMADA',
    'GME': 'GLICEMIA MÉDIA ESTIMADA',
    'T4L': 'T4 LIVRE',
    'T4 LIVRE': 'T4 LIVRE',
    'T3L': 'T3 LIVRE',
    'T3 LIVRE': 'T3 LIVRE',
    'TRANSAMINASE GLUTAMICO OXALACETICA (TGO)': 'AST (TGO)',
    'TRANSAMINASE GLUTAMICO OXALACETICA': 'AST (TGO)',
    'TRANSAMINASE OXALACETICA TGO (AST)': 'AST (TGO)',
    'TRANSAMINASE OXALACETICA TGO': 'AST (TGO)',
    'TGO': 'AST (TGO)',
    'AST': 'AST (TGO)',
    'TRANSAMINASE GLUTAMICO PIRUVICA (TGP)': 'ALT (TGP)',
    'TRANSAMINASE GLUTAMICO PIRUVICA': 'ALT (TGP)',
    'TRANSAMINASE PIRUVICA TGP (ALT)': 'ALT (TGP)',
    'TRANSAMINASE PIRUVICA TGP': 'ALT (TGP)',
    'TGP': 'ALT (TGP)',
    'ALT': 'ALT (TGP)',
    'GAMMA GT': 'GGT',
    'GAMA GT': 'GGT',
    'GAMMA-GLUTAMILTRANSFERASE': 'GGT',
    'GAMA GLUTAMIL TRANSFERASE': 'GGT',
    'VITAMINA D (25-OH)': 'VITAMINA D',
    '25-OH-VITAMINA D': 'VITAMINA D',
    '25-HIDROXI VITAMINA D': 'VITAMINA D',
    'VITAMINA D3 25-HIDROXI': 'VITAMINA D',
    'VITAMINA D3': 'VITAMINA D',
    '25-HIDROXI VITAMINA D3': 'VITAMINA D',
    '25-HIDROXI-VITAMINA D3': 'VITAMINA D',
    'VITAMINA D3 (25-OH)': 'VITAMINA D',
    'VITAMINA D3 25-OH': 'VITAMINA D',
    'VITAMINA D 25-HIDROXI': 'VITAMINA D',
    'VITAMINA B12 (COBALAMINA)': 'VITAMINA B12',
    'COBALAMINA': 'VITAMINA B12',
    'B12': 'VITAMINA B12',
    'VITAMINA B-12': 'VITAMINA B12',
    'TSH': 'TSH',
    'TSH - TIREOESTIMULANTE': 'TSH',
    'TSH ULTRA SENSIVEL': 'TSH',
    'TSH - ULTRA SENSIVEL': 'TSH',
    'HORMONIO TIREOESTIMULANTE (TSH)': 'TSH',
    'HORMONIO TIREOESTIMULANTE': 'TSH',
    'LH - HORMÔNIO LUTEINIZANTE': 'LH',
    'LH - HORMONIO LUTEINIZANTE': 'LH',
    'HORMONIO LUTEINIZANTE (LH)': 'LH',
    'HORMONIO LUTEINIZANTE': 'LH',
    'FSH - HORMÔNIO FOLÍCULO ESTIMULANTE': 'FSH',
    'FSH - HORMONIO FOLICULO ESTIMULANTE': 'FSH',
    'HORMONIO FOLÍCULO ESTIMULANTE (FSH)': 'FSH',
    'HORMONIO FOLICULO ESTIMULANTE': 'FSH',
    'TESTOSTERONA TOTAL': 'TESTOSTERONA TOTAL',
    'TESTOSTERONA': 'TESTOSTERONA TOTAL',
    'SHBG': 'SHBG',
    'GLOBULINA LIGADORA DE HORMONIOS SEXUAIS': 'SHBG',
    'ALBUMINA': 'ALBUMINA',
    'PROTEINA C REATIVA': 'PROTEÍNA C REATIVA',
    'PROTEINA C-REATIVA': 'PROTEÍNA C REATIVA',
    'PROTEINA C REATIVA ULTRASSENSIVEL': 'PROTEÍNA C REATIVA',
    'PROTEINA C REATIVA ULTRA-SENSIVEL': 'PROTEÍNA C REATIVA',
    'PROTEÍNA C REATIVA ULTRASSENSÍVEL': 'PROTEÍNA C REATIVA',
    'PCR': 'PROTEÍNA C REATIVA',
    'PCR ULTRASSENSIVEL': 'PROTEÍNA C REATIVA',
    'PARATORMONIO': 'PARATORMÔNIO',
    'PARATORMONIO (PTH)': 'PARATORMÔNIO',
    'PARATORMÔNIO': 'PARATORMÔNIO',
    'PTH': 'PARATORMÔNIO'
  };
  
  if (synonymMap[strippedClean]) {
    return synonymMap[strippedClean];
  }
  
  // Custom case for Lipoproteína "A" or Lipoproteína "a"
  if (strippedClean.startsWith('LIPOPROTEINA')) {
    return 'LIPOPROTEÍNA A';
  }
  
  return clean;
}

export function calculateFreeTestoVermeulen(totalTesto: number, shbg: number, albumin: number = 4.3): number {
  // Convert units to mol/L
  // Total Testosterone: ng/dL to mol/L (1 ng/dL = 0.0347 nmol/L)
  const T = totalTesto * 0.0347 * 1e-9; 
  const SHBG = shbg * 1e-9; // nmol/L to mol/L
  const ALB = albumin * 1.505e-4; // g/dL to mol/L
  
  const Ka = 3.6e4; // Association constant for Albumin (L/mol)
  const Ks = 1.0e9; // Association constant for SHBG (L/mol)
  
  // Exact quadratic/iterative solver for free testosterone (FT) in mol/L
  let FT = T * 0.02; // Initial guess: 2% of total testosterone
  for (let i = 0; i < 15; i++) {
    const cAlb = 1 + Ka * ALB;
    const cShbg = SHBG / (1 + Ks * FT);
    const nextFT = T / (cAlb + cShbg * Ks);
    if (Math.abs(nextFT - FT) < 1e-15) {
      FT = nextFT;
      break;
    }
    FT = nextFT;
  }
  
  // Convert from mol/L back to pg/mL
  // FT * 288.4 (MW) * 1e9 = pg/mL
  const ftPgVal = FT * 288.4 * 1e9;
  return parseFloat(ftPgVal.toFixed(2));
}

export function calculateMarkers(biomarkers: BiomarkerItem[], age?: number): BiomarkerItem[] {
  // Normalize all biomarker names first
  const normalizedInput = biomarkers.map(b => ({
    ...b,
    name: normalizeBiomarkerName(b.name)
  }));

  // Clean up input from any existing calculations or duplicates to keep them unified!
  const results = normalizedInput.filter(b => 
    b.name !== 'HOMA-IR' && 
    b.name !== 'RELAÇÃO TG/HDL' && 
    b.name !== 'RELAÇÃO CT/HDL' && 
    b.name !== 'RAZÃO DE RITIS' && 
    b.name !== 'TESTOSTERONA LIVRE' &&
    b.name !== 'FIB-4' &&
    b.name !== 'RELAÇÃO NEUTRÓFILOS/LINFÓCITOS (NLR)' &&
    b.name !== 'RELAÇÃO PLAQUETAS/LINFÓCITOS (PLR)' &&
    b.name !== 'RELAÇÃO PSA LIVRE/TOTAL' &&
    b.name !== 'IDADE'
  );

  const glicoseMarker = normalizedInput.find(b => b.name === 'GLICOSE');
  const insulinaMarker = normalizedInput.find(b => b.name === 'INSULINA');
  const tgMarker = normalizedInput.find(b => b.name === 'TRIGLICERÍDEOS');
  const hdlMarker = normalizedInput.find(b => b.name === 'COLESTEROL HDL');
  const ctMarker = normalizedInput.find(b => b.name === 'COLESTEROL TOTAL');
  
  // 1. Cálculo HOMA-IR (glicose * insulina / 405)
  if (glicoseMarker && insulinaMarker) {
    const glicoseVal = parseFloat(String(glicoseMarker.value).replace(',', '.'));
    const insulinaVal = parseFloat(String(insulinaMarker.value).replace(',', '.'));
    if (!isNaN(glicoseVal) && !isNaN(insulinaVal)) {
      const homa = parseFloat(((glicoseVal * insulinaVal) / 405).toFixed(2));
      results.push({
        name: 'HOMA-IR',
        value: homa,
        unit: 'índice',
        referenceRange: 'Inferior a 2.00',
        status: homa < 2.0 ? 'normal' : 'alto'
      });
    }
  }
  
  // 2. Relação TG/HDL
  if (tgMarker && hdlMarker) {
    const tgVal = parseFloat(String(tgMarker.value).replace(',', '.'));
    const hdlVal = parseFloat(String(hdlMarker.value).replace(',', '.'));
    if (!isNaN(tgVal) && !isNaN(hdlVal)) {
      const ratio = parseFloat((tgVal / hdlVal).toFixed(2));
      results.push({
        name: 'RELAÇÃO TG/HDL',
        value: ratio,
        unit: 'razão',
        referenceRange: 'Desejável < 2.0, Limite < 3.0',
        status: ratio < 2.0 ? 'normal' : (ratio < 3.0 ? 'alterado' : 'alto')
      });
    }
  }
  
  // 3. Relação CT/HDL
  if (ctMarker && hdlMarker) {
    const ctVal = parseFloat(String(ctMarker.value).replace(',', '.'));
    const hdlVal = parseFloat(String(hdlMarker.value).replace(',', '.'));
    if (!isNaN(ctVal) && !isNaN(hdlVal)) {
      const ratio = parseFloat((ctVal / hdlVal).toFixed(2));
      results.push({
        name: 'RELAÇÃO CT/HDL',
        value: ratio,
        unit: 'razão',
        referenceRange: 'Desejável < 4.5',
        status: ratio < 4.5 ? 'normal' : 'alto'
      });
    }
  }

  // 4. Razão de Ritis (AST / ALT)
  const astMarker = normalizedInput.find(b => b.name === 'AST (TGO)');
  const altMarker = normalizedInput.find(b => b.name === 'ALT (TGP)');
  if (astMarker && altMarker) {
    const astVal = parseFloat(String(astMarker.value).replace(',', '.'));
    const altVal = parseFloat(String(altMarker.value).replace(',', '.'));
    if (!isNaN(astVal) && !isNaN(altVal) && altVal > 0) {
      const deRitis = parseFloat((astVal / altVal).toFixed(2));
      results.push({
        name: 'RAZÃO DE RITIS',
        value: deRitis,
        unit: 'razão',
        referenceRange: '0.80 - 1.30',
        status: (deRitis >= 0.8 && deRitis <= 1.3) ? 'normal' : 'alterado'
      });
    }
  }
  
  // 5. Testosterona Livre Calculada (Vermeulen)
  const testoMarker = normalizedInput.find(b => b.name === 'TESTOSTERONA TOTAL');
  const shbgMarker = normalizedInput.find(b => b.name === 'SHBG');
  const albMarker = normalizedInput.find(b => b.name === 'ALBUMINA');
  if (testoMarker && shbgMarker) {
    const testoVal = parseFloat(String(testoMarker.value).replace(',', '.'));
    const shbgVal = parseFloat(String(shbgMarker.value).replace(',', '.'));
    const albVal = albMarker ? parseFloat(String(albMarker.value).replace(',', '.')) : 4.3;
    
    if (!isNaN(testoVal) && !isNaN(shbgVal)) {
      const freeTesto = calculateFreeTestoVermeulen(testoVal, shbgVal, isNaN(albVal) ? 4.3 : albVal);
      results.push({
        name: 'TESTOSTERONA LIVRE',
        value: freeTesto,
        unit: 'pg/mL',
        referenceRange: '30.00 - 150.00 pg/mL',
        status: (freeTesto >= 30.0 && freeTesto <= 150.0) ? 'normal' : (freeTesto < 30.0 ? 'baixo' : 'alto')
      });
    }
  }

  // 6. FIB-4 = (Idade * AST) / (Plaquetas * sqrt(ALT))
  if (age !== undefined && age > 0 && astMarker && altMarker) {
    const plaquetasMarker = normalizedInput.find(b => b.name === 'PLAQUETAS');
    if (plaquetasMarker) {
      const astVal = parseFloat(String(astMarker.value).replace(',', '.'));
      const altVal = parseFloat(String(altMarker.value).replace(',', '.'));
      let plaquetasVal = parseFloat(String(plaquetasMarker.value).replace(',', '.'));
      
      // Normalize platelets to 10^9/L (e.g. 200 instead of 200,000)
      if (plaquetasVal > 1000) {
        plaquetasVal = plaquetasVal / 1000;
      }

      if (!isNaN(astVal) && !isNaN(altVal) && !isNaN(plaquetasVal) && altVal > 0 && plaquetasVal > 0) {
        const fib4 = parseFloat(((age * astVal) / (plaquetasVal * Math.sqrt(altVal))).toFixed(2));
        results.push({
          name: 'FIB-4',
          value: fib4,
          unit: 'índice',
          referenceRange: 'Inferior a 1.30',
          status: fib4 < 1.3 ? 'normal' : 'alto'
        });
      }
    }
  }

  // 7. Relação Neutrófilos/Linfócitos (NLR) = Segmentados / Linfócitos
  const segmentadosMarker = normalizedInput.find(b => b.name === 'SEGMENTADOS');
  const linfocitosMarker = normalizedInput.find(b => b.name === 'LINFÓCITOS');
  if (segmentadosMarker && linfocitosMarker) {
    const segVal = parseFloat(String(segmentadosMarker.value).replace(',', '.'));
    const linfVal = parseFloat(String(linfocitosMarker.value).replace(',', '.'));
    if (!isNaN(segVal) && !isNaN(linfVal) && linfVal > 0) {
      const nlr = parseFloat((segVal / linfVal).toFixed(2));
      results.push({
        name: 'RELAÇÃO NEUTRÓFILOS/LINFÓCITOS (NLR)',
        value: nlr,
        unit: 'razão',
        referenceRange: '1.00 - 3.00',
        status: (nlr >= 1.0 && nlr <= 3.0) ? 'normal' : 'alterado'
      });
    }
  }

  // 8. Relação Plaquetas/Linfócitos (PLR) = Plaquetas / (Leucócitos * Linfócitos / 100)
  const leucocitosMarker = normalizedInput.find(b => b.name === 'LEUCÓCITOS');
  const plaquetasMarker = normalizedInput.find(b => b.name === 'PLAQUETAS');
  if (leucocitosMarker && plaquetasMarker && linfocitosMarker) {
    const leucocitosVal = parseFloat(String(leucocitosMarker.value).replace(',', '.'));
    let plaquetasVal = parseFloat(String(plaquetasMarker.value).replace(',', '.'));
    const linfocitosVal = parseFloat(String(linfocitosMarker.value).replace(',', '.')); // in %

    if (plaquetasVal > 1000) {
      plaquetasVal = plaquetasVal / 1000;
    }

    if (!isNaN(leucocitosVal) && !isNaN(plaquetasVal) && !isNaN(linfocitosVal) && leucocitosVal > 0 && linfocitosVal > 0) {
      const absPlatelets = plaquetasVal * 1000;
      const absLymphocytes = leucocitosVal * (linfocitosVal / 100);
      if (absLymphocytes > 0) {
        const plr = parseFloat((absPlatelets / absLymphocytes).toFixed(2));
        results.push({
          name: 'RELAÇÃO PLAQUETAS/LINFÓCITOS (PLR)',
          value: plr,
          unit: 'razão',
          referenceRange: '80.00 - 150.00',
          status: (plr >= 80.0 && plr <= 150.0) ? 'normal' : 'alterado'
        });
      }
    }
  }

  // 9. Relação PSA Livre/Total
  const psaLivreMarker = normalizedInput.find(b => b.name === 'PSA LIVRE');
  const psaTotalMarker = normalizedInput.find(b => b.name === 'PSA TOTAL');
  if (psaLivreMarker && psaTotalMarker) {
    const psaLivreVal = parseFloat(String(psaLivreMarker.value).replace(',', '.'));
    const psaTotalVal = parseFloat(String(psaTotalMarker.value).replace(',', '.'));
    if (!isNaN(psaLivreVal) && !isNaN(psaTotalVal) && psaTotalVal > 0) {
      const ratio = parseFloat((psaLivreVal / psaTotalVal).toFixed(2));
      results.push({
        name: 'RELAÇÃO PSA LIVRE/TOTAL',
        value: ratio,
        unit: 'razão',
        referenceRange: 'Superior a 0.20',
        status: ratio > 0.2 ? 'normal' : 'baixo'
      });
    }
  }

  // 10. IDADE (Injeção virtual)
  if (age !== undefined && age > 0) {
    results.push({
      name: 'IDADE',
      value: age,
      unit: 'anos',
      referenceRange: '',
      status: 'normal'
    });
  }
  
  return results;
}
