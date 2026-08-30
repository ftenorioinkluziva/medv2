import { LLMServicePort, LLMCallParams } from "../../core/ports/LLMServicePort";
import { OpenRouterCredentialPort } from "../../core/ports/ConfigurationPort";
import { OperationFailure } from "../../core/types/errors";

export class OpenRouterAdapter implements LLMServicePort {
  constructor(private credentials: OpenRouterCredentialPort) {}

  async call({ prompt, systemPrompt, model, responseJson }: LLMCallParams): Promise<unknown> {
    const apiKey = await this.credentials.getOpenRouterApiKey();

    if (!apiKey) {
      throw new OperationFailure({
        code: "OPENROUTER_CREDENTIAL_MISSING",
        category: "authorization",
        message: "OpenRouter API Key não configurada.",
        hint: "Acesse as Configurações no painel e insira sua chave.",
        retryable: false
      });
    }

    if (!model) {
      throw new OperationFailure({
        code: "MODEL_NOT_SELECTED",
        category: "validation",
        message: "Nenhum modelo foi selecionado para a operação.",
        retryable: false
      });
    }
    const selectedModel = model;
    const messages: any[] = [];

    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt
      });
    }

    messages.push({
      role: "user",
      content: prompt
    });

    const body: any = {
      model: selectedModel,
      messages: messages,
      temperature: 0.2 // Lower temp for more deterministic structured outputs
    };

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "MedV2 Exam Analyzer"
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000)
      });

      if (!response.ok) {
        const category = response.status === 401 || response.status === 403
          ? "authorization"
          : response.status === 429
            ? "rate_limit"
            : "upstream";
        throw new OperationFailure({
          code: response.status === 429 ? "OPENROUTER_RATE_LIMITED" : "OPENROUTER_REQUEST_FAILED",
          category,
          message: `A OpenRouter recusou a solicitação (${response.status}).`,
          hint: response.status === 401 || response.status === 403
            ? "Confira a credencial configurada para a OpenRouter."
            : undefined,
          retryable: response.status === 429 || response.status >= 500
        });
      }

      const result = await response.json();

      if (!result || typeof result !== "object" || !("choices" in result) || !Array.isArray(result.choices) || result.choices.length === 0) {
        throw new OperationFailure({
          code: "OPENROUTER_RESPONSE_INVALID",
          category: "upstream",
          message: "A OpenRouter retornou uma resposta sem conteúdo utilizável.",
          retryable: true
        });
      }

      const content = (result.choices[0] as any)?.message?.content;

      if (responseJson) {
        return this.cleanAndParseJson(content);
      }

      return content;
    } catch (error: unknown) {
      if (error instanceof OperationFailure) throw error;
      throw new OperationFailure({
        code: "OPENROUTER_UNAVAILABLE",
        category: "upstream",
        message: "Não foi possível concluir a chamada à OpenRouter.",
        retryable: true
      }, { cause: error });
    }
  }

  private cleanAndParseJson(content: string): any {
    if (!content) {
      throw new OperationFailure({
        code: "LLM_OUTPUT_EMPTY",
        category: "upstream",
        message: "O modelo retornou uma resposta vazia.",
        retryable: true
      });
    }

    let cleaned = content.trim();

    // Remove markdown code blocks if the LLM output is wrapped in them
    if (cleaned.startsWith("```")) {
      const firstNewline = cleaned.indexOf("\n");
      if (firstNewline !== -1) {
        cleaned = cleaned.substring(firstNewline + 1);
      } else {
        cleaned = cleaned.replace(/^```(json)?/i, "");
      }
      // Remove trailing code block
      cleaned = cleaned.replace(/```$/, "").trim();
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed === null) {
        throw new Error("A resposta de formato estruturado (JSON) retornou vazia (null) pelo modelo.");
      }
      return parsed;
    } catch (err: any) {
      throw new OperationFailure({
        code: "LLM_OUTPUT_INVALID_JSON",
        category: "upstream",
        message: "A resposta do modelo não pôde ser convertida para JSON.",
        retryable: true
      }, { cause: err });
    }
  }
}
