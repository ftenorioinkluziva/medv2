import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "../components/common";
import type { Profile } from "../types";

type FieldType = "text" | "number" | "textarea" | "select" | "time";
interface Field { key: keyof Profile; label: string; type?: FieldType; options?: string[]; hint?: string }
interface FieldSection { id: string; title: string; description: string; fields: Field[] }

const sections: FieldSection[] = [
  { id: "identity", title: "Dados básicos", description: "Identificação e composição corporal usadas no contexto das análises.", fields: [
    { key: "nome", label: "Nome" }, { key: "idade", label: "Idade", type: "number" }, { key: "sexo", label: "Sexo", type: "select", options: ["", "masculino", "feminino", "outro"] }, { key: "altura", label: "Altura (cm)", type: "number" }, { key: "peso", label: "Peso (kg)", type: "number" }, { key: "massaMagra", label: "Massa magra (kg)", type: "number" }, { key: "cardioSistolica", label: "Pressão sistólica", type: "number" }, { key: "cardioDiastolica", label: "Pressão diastólica", type: "number" }, { key: "cardioFcRepouso", label: "FC de repouso", type: "number" }, { key: "objetivos", label: "Objetivos", type: "textarea" }
  ]},
  { id: "history", title: "Histórico de saúde", description: "Informações relevantes para contextualizar os resultados.", fields: [
    { key: "condicoesMedicas", label: "Condições médicas", type: "textarea" }, { key: "medicamentos", label: "Medicamentos", type: "textarea" }, { key: "alergias", label: "Alergias", type: "textarea" }, { key: "cirurgias", label: "Cirurgias", type: "textarea" }, { key: "historicoFamiliar", label: "Histórico familiar", type: "textarea" }, { key: "observacoes", label: "Observações", type: "textarea" }
  ]},
  { id: "lifestyle", title: "Sono e estilo de vida", description: "Rotina, recuperação e fatores cotidianos.", fields: [
    { key: "sonoHoras", label: "Horas de sono", type: "number" }, { key: "sonoQualidade", label: "Qualidade do sono (0–10)", type: "number" }, { key: "sonoTempoCama", label: "Tempo na cama", type: "number" }, { key: "sonoRegularidade", label: "Regularidade do sono" }, { key: "sonoProblemas", label: "Problemas de sono", type: "textarea" }, { key: "aguaDia", label: "Água por dia (L)", type: "number" }, { key: "nivelEstresse", label: "Nível de estresse (0–10)", type: "number" }, { key: "tabagismo", label: "Tabagismo" }, { key: "dietaAtual", label: "Dieta atual", type: "textarea" }, { key: "gestaoEstresse", label: "Gestão de estresse", type: "textarea" }, { key: "suplementacaoAtual", label: "Suplementação atual", type: "textarea" }
  ]},
  { id: "circadian", title: "Ritmo circadiano", description: "Exposição solar, refeições e luz artificial.", fields: [
    { key: "cronoExposicaoSolar", label: "Exposição solar" }, { key: "cronoUltimaRefeicao", label: "Horário da última refeição", type: "time" }, { key: "cronoLuzArtInicio", label: "Início da luz artificial", type: "time" }, { key: "cronoLuzArtFim", label: "Fim da luz artificial", type: "time" }, { key: "cronoObsLuz", label: "Observações sobre luz", type: "textarea" }
  ]},
  { id: "performance", title: "Capacidade física", description: "Indicadores funcionais e rotina de exercício.", fields: [
    { key: "perfForcaPreensao", label: "Força de preensão", type: "number" }, { key: "perfSentarLevantar", label: "Teste sentar e levantar", type: "number" }, { key: "perfVo2Max", label: "VO2 máx", type: "number" }, { key: "perfToleranciaCo2", label: "Tolerância a CO2", type: "number" }, { key: "perfAtividadeFisica", label: "Atividade física", type: "textarea" }, { key: "limitacoesFisicas", label: "Limitações físicas", type: "textarea" }, { key: "exerciseFrequency", label: "Frequência de exercício" }, { key: "exerciseTypes", label: "Tipos de exercício", type: "textarea" }, { key: "exerciseIntensity", label: "Intensidade" }, { key: "typicalSessionDuration", label: "Duração típica" }, { key: "dailyMovement", label: "Movimento diário", type: "textarea" }, { key: "muscleContext", label: "Contexto muscular", type: "textarea" }, { key: "limitationsAndRecovery", label: "Limitações e recuperação", type: "textarea" }, { key: "exerciseNotes", label: "Notas de exercício", type: "textarea" }
  ]},
  { id: "nutrition", title: "Nutrição e digestão", description: "Padrões alimentares, digestão e sensibilidades.", fields: [
    { key: "dietType", label: "Tipo de dieta" }, { key: "eatingPattern", label: "Padrão alimentar" }, { key: "proteinIntake", label: "Ingestão de proteína" }, { key: "fluidIntake", label: "Ingestão de líquidos" }, { key: "dietaryRestrictions", label: "Restrições alimentares", type: "textarea" }, { key: "alcoholConsumption", label: "Consumo de álcool" }, { key: "caffeineIntake", label: "Consumo de cafeína" }, { key: "latestCaffeineTime", label: "Última cafeína", type: "time" }, { key: "recentDietChanges", label: "Mudanças recentes", type: "textarea" }, { key: "typicalMeals", label: "Refeições típicas", type: "textarea" }, { key: "bowelFrequency", label: "Frequência intestinal" }, { key: "stoolConsistency", label: "Consistência das fezes" }, { key: "bloating", label: "Distensão abdominal" }, { key: "gas", label: "Gases" }, { key: "acidReflux", label: "Refluxo" }, { key: "burping", label: "Eructação" }, { key: "nausea", label: "Náusea" }, { key: "appetite", label: "Apetite" }, { key: "abdominalPain", label: "Dor abdominal" }, { key: "foodSensitivities", label: "Sensibilidades alimentares", type: "textarea" }, { key: "dietaryNotes", label: "Notas nutricionais", type: "textarea" }
  ]}
];
const numericKeys = new Set<keyof Profile>(["idade", "altura", "peso", "massaMagra", "cardioSistolica", "cardioDiastolica", "cardioFcRepouso", "sonoHoras", "sonoQualidade", "sonoTempoCama", "aguaDia", "nivelEstresse", "perfForcaPreensao", "perfSentarLevantar", "perfVo2Max", "perfToleranciaCo2"]);

export function ProfileForm({ profile, onSave, busy }: { profile: Profile; onSave: (profile: Profile) => Promise<void>; busy: boolean }) {
  const [active, setActive] = useState(sections[0].id);
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);
  const imc = useMemo(() => draft.altura > 0 && draft.peso > 0 ? Number((draft.peso / ((draft.altura / 100) ** 2)).toFixed(1)) : 0, [draft.altura, draft.peso]);
  const section = sections.find(item => item.id === active) ?? sections[0];
  function setValue(key: keyof Profile, raw: string) {
    setDraft(current => ({ ...current, [key]: numericKeys.has(key) ? (raw === "" ? 0 : Number(raw)) : raw }));
  }
  return <div className="page-stack"><SectionHeader title="Perfil" meta="Contexto usado para interpretar exames e planos"><div className="profile-score"><span>IMC calculado</span><strong>{imc || "—"}</strong></div></SectionHeader><nav className="profile-nav" aria-label="Seções do perfil">{sections.map(item => <button type="button" key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}>{item.title}</button>)}</nav><form className="content-card profile-form" onSubmit={event => { event.preventDefault(); onSave({ ...draft, imc }); }}><SectionHeader title={section.title} meta={section.description} /><div className="field-grid">{section.fields.map(field => <label key={field.key}><span>{field.label}</span>{field.type === "textarea" ? <textarea rows={3} value={String(draft[field.key] ?? "")} onChange={event => setValue(field.key, event.target.value)} /> : field.type === "select" ? <select value={String(draft[field.key] ?? "")} onChange={event => setValue(field.key, event.target.value)}>{field.options?.map(option => <option key={option} value={option}>{option || "Selecione"}</option>)}</select> : <input type={field.type ?? "text"} step={field.type === "number" ? "any" : undefined} value={String(draft[field.key] ?? "")} onChange={event => setValue(field.key, event.target.value)} />}</label>)}</div><footer className="form-actions"><button className="button primary" disabled={busy}>{busy ? "Salvando..." : "Salvar perfil"}</button></footer></form></div>;
}
