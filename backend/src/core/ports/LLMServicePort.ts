export interface LLMCallParams {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  responseJson?: boolean;
}

export interface LLMServicePort {
  call(params: LLMCallParams): Promise<unknown>;
}
