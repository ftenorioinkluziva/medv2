import { PDFParserPort } from "../ports/PDFParserPort";
import { LLMServicePort } from "../ports/LLMServicePort";
import { DatabasePort } from "../ports/DatabasePort";
import { Result } from "../types/Result";
import { BloodTestResult, BloodTestResultSchema, BioimpedanceResult, BioimpedanceResultSchema } from "../schemas/biomarkers";
import { toOperationError } from "../types/errors";
import { AnalysisConfigurationPort } from "../ports/ConfigurationPort";

export class ParseDocumentUseCase {
  constructor(
    private pdfParser: PDFParserPort,
    private llmService: LLMServicePort,
    private configuration: AnalysisConfigurationPort
  ) {}

  async parseBloodTest(userId: string, buffer: Buffer): Promise<Result<BloodTestResult>> {
    try {
      const text = await this.pdfParser.extractText(buffer);
      const settings = await this.configuration.getAnalysisConfiguration(userId);
      const model = settings.modelExtraction;

      const systemPrompt = "Você é um extrator de exames laboratoriais altamente preciso. Sua tarefa é analisar o texto bruto de exames de sangue e retornar um JSON contendo a data do exame e todos os biomarcadores identificados.";
      
      const prompt = `Analise o texto bruto de exames de sangue e retorne um JSON contendo a data de coleta do exame (formato YYYY-MM-DD) e todos os biomarcadores identificados.
Extraia a data de coleta a partir de informações como 'Coleta: DD/MM/AAAA' ou similares e converta para YYYY-MM-DD.
Para cada exame/biomarcador encontrado, extraia os seguintes campos:
- name: Nome limpo do biomarcador (ex: 'GLICOSE', 'HEMOGLOBINA', 'COLESTEROL HDL', 'T4 LIVRE'). Use letras maiúsculas e padronizadas.
- value: O resultado numérico obtido (ex: 93, 15.8, 1.27). Se o resultado for textual, retorne-o como string.
- unit: Unidade de medida (ex: 'mg/dL', 'g/dL', '%', 'fl').
- referenceRange: O intervalo de referência fornecido no laudo (ex: '70 a 99 mg/dL').
- status: Status do biomarcador em relação à referência. Valores aceitáveis: 'normal', 'alto', 'baixo', 'alterado'.

Formato de saída esperado:
{
  "date": "2026-03-14",
  "biomarkers": [
    {
      "name": "GLICOSE",
      "value": 93,
      "unit": "mg/dL",
      "referenceRange": "70 a 99 mg/dL",
      "status": "normal"
    }
  ]
}

Responda APENAS com o JSON válido, sem comentários ou explicações.

Aqui está o texto bruto do laudo de exames de sangue:
${text}`;

      const rawResult = await this.llmService.call({
        prompt,
        systemPrompt,
        model,
        responseJson: true
      });

      const parsed = BloodTestResultSchema.safeParse(rawResult);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "INVALID_LLM_OUTPUT",
            category: "upstream",
            message: "O modelo retornou dados estruturados em formato inválido para exames de sangue.",
            retryable: true,
            hint: parsed.error.message
          }
        };
      }

      return { ok: true, value: parsed.data };
    } catch (err: any) {
      return {
        ok: false,
        error: toOperationError(err, {
          code: "EXTRACTION_FAILED",
          category: "internal",
          message: "Falha na extração e parsing do PDF.",
          retryable: false
        })
      };
    }
  }

  async parseBioimpedance(userId: string, buffer: Buffer): Promise<Result<BioimpedanceResult>> {
    try {
      const text = await this.pdfParser.extractText(buffer);
      const settings = await this.configuration.getAnalysisConfiguration(userId);
      const model = settings.modelExtraction;

      const systemPrompt = "Você é um extrator de dados de bioimpedância altamente preciso. Sua tarefa é extrair os dados corporais a partir do texto bruto fornecido e retornar um objeto JSON.";

      const prompt = `Analise o texto bruto de bioimpedância e extraia os dados corporais em formato JSON.
Extraia os seguintes campos se estiverem presentes no texto:
- dataExame: A data em que o exame foi realizado no formato 'AAAA-MM-DD'. Se apenas encontrar a data com barras (ex: 12/01/2026), converta para YYYY-MM-DD.
- altura: A altura do paciente em centímetros (número, ex: 170).
- peso: O peso total em kg (número, ex: 90.9).
- massaMagra: A massa muscular esquelética ou massa magra em kg (número, ex: 36.7).
- imc: O índice de massa corporal em kg/m² (número, ex: 31.5).
- inbodyScore: A pontuação InBody ou score geral do exame (número, ex: 74). Se não houver, retorne null.
- percentualGordura: O percentual de gordura corporal (%) (número, ex: 29.5).
- massaGordura: A massa de gordura em kg (número, ex: 26.8).
- aguaCorporal: A quantidade de água corporal total em L (número, ex: 46.9).
- proteina: A quantidade de proteína em kg (número, ex: 12.8).
- minerais: A quantidade de minerais em kg (número, ex: 4.3).
- taxaMetabolicaBasal: A taxa metabólica basal em kcal (número, ex: 1753).
- relacaoCinturaQuadril: A relação cintura-quadril (número, ex: 0.98).
- nivelGorduraVisceral: O nível de gordura visceral (número, ex: 11).

Formato de saída esperado:
{
  "dataExame": "2026-01-12",
  "altura": 170,
  "peso": 90.9,
  "massaMagra": 36.7,
  "imc": 31.5,
  "inbodyScore": 74,
  "percentualGordura": 29.5,
  "massaGordura": 26.8,
  "aguaCorporal": 46.9,
  "proteina": 12.8,
  "minerais": 4.3,
  "taxaMetabolicaBasal": 1753,
  "relacaoCinturaQuadril": 0.98,
  "nivelGorduraVisceral": 11
}

Responda APENAS com o JSON válido, sem comentários ou explicações.

Aqui está o texto bruto da bioimpedância:
${text}`;

      const rawResult = await this.llmService.call({
        prompt,
        systemPrompt,
        model,
        responseJson: true
      });

      const parsed = BioimpedanceResultSchema.safeParse(rawResult);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "INVALID_LLM_OUTPUT",
            category: "upstream",
            message: "O modelo retornou dados estruturados em formato inválido para bioimpedância.",
            retryable: true,
            hint: parsed.error.message
          }
        };
      }

      return { ok: true, value: parsed.data };
    } catch (err: any) {
      return {
        ok: false,
        error: toOperationError(err, {
          code: "EXTRACTION_FAILED",
          category: "internal",
          message: "Falha na extração e parsing do PDF.",
          retryable: false
        })
      };
    }
  }
}
