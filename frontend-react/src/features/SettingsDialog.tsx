import { useEffect, useState } from "react";
import { Dialog } from "../components/common";
import { api } from "../lib/api";
import type { Settings } from "../types";

export function SettingsDialog({ open, settings, onClose, onSaved, notify }: {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSaved: (settings: Settings) => void;
  notify: (message: string, tone?: "success" | "danger") => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(settings), [settings, open]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.saveSettings({
        modelExtraction: draft.modelExtraction,
        modelAnalysis: draft.modelAnalysis,
        lens: draft.lens,
        lensLongevidade: draft.lensLongevidade,
        lensConvencional: draft.lensConvencional,
        lensPerformance: draft.lensPerformance
      });
      const refreshed = (await api.settings()).settings;
      onSaved(refreshed);
      notify("Configurações atualizadas.", "success");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível salvar as configurações.", "danger");
    } finally { setBusy(false); }
  }

  return <Dialog title="Configurações" open={open} onClose={onClose}>
    <form className="form-stack" onSubmit={save}>
      <div className="credential-state"><span>OpenRouter</span><strong>{settings.hasKey ? "Configurada no servidor" : "Não configurada"}</strong></div>
      <label>Modelo para extração<select value={draft.modelExtraction} onChange={event => setDraft({ ...draft, modelExtraction: event.target.value })}>
        <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option><option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option><option value="deepseek/deepseek-chat">DeepSeek V3</option><option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
      </select></label>
      <label>Modelo para análise<select value={draft.modelAnalysis} onChange={event => setDraft({ ...draft, modelAnalysis: event.target.value })}>
        <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option><option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option><option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option><option value="deepseek/deepseek-chat">DeepSeek V3</option>
      </select></label>
      <label>Lente interpretativa<select value={draft.lens} onChange={event => setDraft({ ...draft, lens: event.target.value as Settings["lens"] })}>
        <option value="longevidade">Otimização e Longevidade</option><option value="convencional">Medicina Convencional</option><option value="performance">Performance Esportiva</option>
      </select></label>
      <details><summary>Customizar prompts das lentes</summary>
        <div className="form-stack compact">
          <label>Longevidade<textarea rows={3} value={draft.lensLongevidade ?? ""} onChange={event => setDraft({ ...draft, lensLongevidade: event.target.value })} /></label>
          <label>Convencional<textarea rows={3} value={draft.lensConvencional ?? ""} onChange={event => setDraft({ ...draft, lensConvencional: event.target.value })} /></label>
          <label>Performance<textarea rows={3} value={draft.lensPerformance ?? ""} onChange={event => setDraft({ ...draft, lensPerformance: event.target.value })} /></label>
        </div>
      </details>
      <footer className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button></footer>
    </form>
  </Dialog>;
}
