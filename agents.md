# Constituição Central do Projeto (agents.md) — MedV2

> **Documento Mandatório de Engenharia Agentiva**: Este arquivo constitui a autoridade máxima de contexto para inteligências artificiais e agentes LLM que atuam no repositório **MedV2**. Nenhuma alteração de código, refatoração, extensão arquitetural ou adição de funcionalidade pode violar as diretrizes, invariantes, modelos de dados ou proibições categóricas documentadas nesta constituição.

---

## 1. Papel do Agente de IA e Metodologia Operacional

O agente atua como um engenheiro de software sênior operando sob o paradigma **Domain-Driven Design (DDD)** e **Ports and Adapters (Arquitetura Hexagonal)**. O assistente não faz suposições sobre regras de negócio, dados clínicos ou integrações externas. Todo código produzido deve ser tipado, determinístico, validado em runtime e coberto por testes.

### 1.1 Fluxo Mandatório de Adição e Alteração de Funcionalidades

Qualquer alteração ou nova operação deve seguir estritamente o pipeline de 6 passos:

```text
[1. Contrato Zod] ──► [2. Port de Domínio] ──► [3. Caso de Uso Puro]
         │                     │                         │
         ▼                     ▼                         ▼
[4. Adaptador I/O] ──► [5. Testes Unitários/E2E] ─► [6. Gates (npm run check)]
```

1. **Definição de Contrato (`backend/src/core/schemas/`)**:
   - Modelar input público, contexto privado, output e variantes de erro com esquemas estritos do `zod`.
2. **Declaração de Port (`backend/src/core/ports/`)**:
   - Criar interface TypeScript desacoplada de tecnologia apenas se houver dependência de infraestrutura externa real (banco, LLM, filesystem, catálogo, etc.).
3. **Implementação de Caso de Uso (`backend/src/core/use-cases/`)**:
   - Orquestrar a regra de negócio pura retornando `Promise<Result<TOutput, OperationError>>` ou lançando `OperationFailure`.
   - **Regra Inviolável**: O caso de uso NUNCA importa Express, `process.env`, `fs`, `fetch`, nem emite `console.log`.
4. **Implementação de Adaptador (`backend/src/adapters/`)**:
   - Traduzir protocolos e I/O de infraestrutura para os tipos do core.
5. **Testes de Contrato, Retries e Compensação (`backend/test/`)**:
   - Cobrir cenários felizes, inputs inválidos, recusas por autorização, categorização de falhas de upstream e compensação/rollback de arquivos órfãos.
6. **Execução de Gates**:
   - Apenas considerar o trabalho concluído após a aprovação de `npm run check` (typecheck + test + build).

---

## 2. Visão do Produto e Decisões Chave de Negócio

### 2.1 Propósito do MedV2
O **MedV2** é um analisador local e seguro de saúde pessoal que extrai dados de exames laboratoriais (sangue) e bioimpedância via PDFs, calcula marcadores e alertas clínicos de forma determinística e gera análises personalizadas por meio de modelos da OpenRouter, organizando o histórico ao longo do tempo.

### 2.2 Perguntas Fundamentais do Usuário
O sucesso da experiência do usuário é medido pela capacidade de responder instantaneamente:
1. *O que mudou no meu estado de saúde?*
2. *Quais indicadores exigem atenção imediata ou revisão?*
3. *Qual plano nutricional/suplementar ou orientação devo consultar agora?*
4. *De qual exame e data específica veio cada recomendação?*

### 2.3 Decisões de Negócio Fundamentais
1. **Natureza Informativa**: O sistema organiza e informa. Não substitui avaliação, diagnóstico ou prescrição médica/nutricional.
2. **Determinismo Clínico antes de IA**: Cálculos e faixas de referência críticas (como triglicerídeos/HDL, HOMA-IR, risco cardiovascular) são avaliados primeiro por algoritmos determinísticos puros (`DeterministicRulesService`), não dependendo de alucinação do modelo.
3. **Preservação de Evidência Dupla**: O JSON original completo da análise é preservado para rastreabilidade histórica, enquanto os biomarcadores individuais são estruturados relacionalmente em tabelas normalizadas para consultas e gráficos.
4. **Isolamento e Privacidade Local**: O software opera localmente por padrão. Dados de exames e PDFs nunca são enviados a serviços terceiros não autorizados. Apenas o texto extraído necessário é enviado ao provedor LLM via OpenRouter.

---

## 3. Pilha Tecnológica (Tech Stack)

| Camada / Função | Tecnologia | Versão / Padrão | Justificativa / Papel |
|---|---|---|---|
| **Runtime Backend** | Node.js / `tsx` | `>= 20` | Execução ESM nativa com TypeScript rápido. |
| **Linguagem** | TypeScript | `5.4+` | Tipagem estrita com compilação segregada (`tsc` e `vite`). |
| **Servidor HTTP** | Express | `4.19+` | Adaptador de transporte HTTP local acoplado ao Composition Root. |
| **Autenticação** | Better Auth | `1.6+` | Autenticação local robusta, sessões persistidas em PostgreSQL. |
| **Validação de Runtime** | Zod | `3.23+` | Single Source of Truth para tipagem estática e validação em runtime. |
| **Banco de Dados** | PostgreSQL | `16` (via `pg 8.23+`) | Fonte única da verdade relacional com Row-Level Security (RLS). |
| **Parser de PDF** | `pdf-parse` / `multer` | `1.1+` / `2.2+` | Upload restrito a 15 MB e extração local de texto de PDFs clínicos. |
| **Integração de IA** | OpenRouter API | REST | Provedor de inferência para LLMs (Gemini Flash/Pro) com fallback de chaves. |
| **Frontend Framework** | React | `19` | SPA reativa, moderna e desacoplada. |
| **Build & Dev Frontend** | Vite | `8.2+` | Bundler e servidor de desenvolvimento com proxy reverso para `/api`. |
| **Design System & CSS** | CSS Puro + OKLCH | Padrão Suíte | Tokens estritos, tema grafite operacional e sem dependência pesada de UI libs. |
| **Testes Unitários e E2E** | Node Test Runner / Vitest | `Node 20+` / `Vitest 4` | Validação de invariantes arquiteturais, erros e interface. |
| **Containerização** | Docker / Compose | Multi-stage | Ambientes isolados de teste local com volumes persistentes. |

---

## 4. Arquitetura do Sistema (Ports & Adapters)

A arquitetura garante desacoplamento total entre o domínio e a infraestrutura externa.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        ADAPTADORES DE ENTRADA                          │
│   [ SPA React (Vite) ]  ──►  [ Express HTTP Adapter (server.ts) ]      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (invoca com DTOs validados)
┌────────────────────────────────────────────────────────────────────────┐
│                            SHARED CORE                                 │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      Casos de Uso (Use Cases)                  │   │
│   │  • ProcessDocumentUseCase     • GenerateAnalysisUseCase        │   │
│   │  • SaveProfileUseCase         • UpdateSettingsUseCase           │   │
│   │  • CrudUseCases (GetAnalyses, History, Settings, Biomarkers)   │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │             Serviços de Domínio Puros e Schemas                │   │
│   │  • DeterministicRulesService   • Zod Schemas (Contract Types)  │   │
│   │  • BiomarkerCalculations       • Result<T, OperationError>     │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │                     Portas (Interfaces/Ports)                  │   │
│   │  DatabasePort, FileStoragePort, LLMServicePort, PDFParserPort, │   │
│   │  KnowledgeBasePort, ExerciseCatalogPort, Runtime                │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                                    ▼ (implementa interfaces)
┌────────────────────────────────────────────────────────────────────────┐
│                        ADAPTADORES DE SAÍDA                            │
│   • PostgresDatabaseAdapter (PostgreSQL 16 + RLS)                      │
│   • LocalFileStorageAdapter (Staging + SHA-256 + Atomic Rename)        │
│   • OpenRouterAdapter (Classificação de Erros & Retries)               │
│   • PdfParseAdapter (Extração de texto local)                          │
│   • PostgresExerciseCatalogAdapter & JsonKnowledgeBaseAdapter           │
│   • SystemRuntimeAdapter (IDs UUID & Clock Determinístico)             │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Política de Efeitos e Consistência de Arquivos
- **Transacionalidade e Compensação**: O banco PostgreSQL gerencia o estado relacional. O filesystem de PDFs não participa de 2PC (Two-Phase Commit). O salvamento adota o fluxo:
  1. PDF recebido em diretório de *staging* temporário;
  2. Validação de assinatura mágica (`%PDF-`) e limite de 15 MB;
  3. Cálculo de hash SHA-256;
  4. Processamento clínico e inferência LLM;
  5. Commit no PostgreSQL;
  6. Rename atômico para o diretório final `uploads/`;
  7. Em caso de falha no banco, acionamento imediato de **compensação** (remoção do arquivo de staging/upload).
- **Idempotência**: Requisições de upload/processamento exigem header `Idempotency-Key` atrelado ao `userId`, prevenindo execuções duplicadas e custos redundantes de IA.

---

## 5. Variáveis de Ambiente e Configuração

O sistema carrega configurações do arquivo `.env` na raiz do projeto. Nenhuma credencial deve ser exposta no código-fonte.

### 5.1 Especificação Completa das Variáveis

| Variável | Obrigatória? | Padrão / Exemplo | Finalidade e Descrição |
|---|---|---|---|
| `PORT` | Opcional | `3000` | Porta TCP em que o servidor Express escuta localmente. |
| `HOST` | Opcional | `127.0.0.1` | Interface de rede. **Obrigatório loopback** (`127.0.0.1` ou `localhost`) no host. |
| `MEDV2_CONTAINER` | Condicional | `false` (ou `true` no Docker) | Autoriza o bind em `0.0.0.0` estritamente dentro de container Docker isolado. |
| `DATABASE_URL` | **Sim** | `postgresql://medv2:medv2_local_password@127.0.0.1:5437/medv2` | String de conexão para o pool do PostgreSQL. |
| `POSTGRES_DB` | Docker/Script | `medv2` | Nome do banco de dados no container PostgreSQL. |
| `POSTGRES_USER` | Docker/Script | `medv2` | Usuário do banco de dados no PostgreSQL. |
| `POSTGRES_PASSWORD` | Docker/Script | `medv2_local_password` | Senha do banco de dados no PostgreSQL. |
| `BETTER_AUTH_SECRET` | **Sim** | `long-random-secret-key-32-chars` | Segredo criptográfico para assinatura de tokens de sessão do Better Auth. |
| `BETTER_AUTH_URL` | **Sim** | `http://127.0.0.1:3000` | URL base confiável da aplicação web para validação de origem e cookies. |
| `BETTER_AUTH_URL_DOCKER` | Docker | `http://127.0.0.1:3011` | URL base quando executado via Docker Compose local. |
| `OPENROUTER_API_KEY` | Opcional | `sk-or-v1-...` | Chave de fallback para a API da OpenRouter (caso não fornecida na UI). |
| `MEDV2_DOCKER_PORT` | Docker | `3011` | Porta mapeada no host para a aplicação no Docker Compose. |
| `MEDV2_POSTGRES_PORT` | Docker | `5437` | Porta mapeada no host para o PostgreSQL do Docker Compose. |

---

## 6. Modelos de Dados e Esquema de Banco (PostgreSQL & Zod)

O PostgreSQL é a fonte da verdade relacional. Todas as tabelas de domínio possuem **Row-Level Security (RLS)** ativo e forçado, isoladas por `app.user_id`.

### 6.1 Tabelas do Banco de Dados

```text
┌───────────────────────────┐         ┌───────────────────────────────┐
│           user            │1       *│            session            │
│ id (PK), email, name      ├─────────┤ id (PK), token, userId (FK)   │
└─────────────┬─────────────┘         └───────────────────────────────┘
              │1
              ├───────────────────────────────┬───────────────────────────────┐
              │*                              │*                              │*
┌─────────────┴─────────────┐   ┌─────────────┴─────────────┐   ┌─────────────┴─────────────┐
│       medv2_profile       │   │      medv2_settings       │   │      medv2_document       │
│ userId (PK, FK), payload  │   │ userId (PK, FK), payload  │   │ id (PK), userId, exam_date│
└───────────────────────────┘   └───────────────────────────┘   └─────────────┬─────────────┘
                                                                              │1
                                                                              │1
                                                                ┌─────────────┴─────────────┐
                                                                │    medv2_document_blob    │
                                                                │ documentId (PK), sha256   │
                                                                └───────────────────────────┘
              ┌───────────────────────────────┬───────────────────────────────┐
              │1                              │*
┌─────────────┴─────────────┐   ┌─────────────┴─────────────┐
│      medv2_analysis       │   │      medv2_operation      │
│ id, version (PK), payload │   │ userId, idempotencyKey(PK)│
└─────────────┬─────────────┘   └───────────────────────────┘
              │1
┌─────────────┴─────────────┐
│ medv2_analysis_annotation │
│ analysisId, version (PK)  │
└───────────────────────────┘
              │*
┌─────────────────────────────┴─────────────────────────────┐
│                 medv2_analysis_biomarker                  │
│ analysisId, analysisVersion, biomarkerId (PK, FK)         │
│ value_numeric, value_text, unit, status                   │
└─────────────────────────────┬─────────────────────────────┘
                              │*
                              │1
┌─────────────────────────────┴─────────────────────────────┐
│                 medv2_biomarker_definition                │
│ id (PK, UUID), code (UNIQUE), canonical_name, aliases     │
└─────────────────────────────┬─────────────────────────────┘
                              │1
                              │*
┌─────────────────────────────┴─────────────────────────────┐
│                   medv2_reference_range                   │
│ id (PK, UUID), biomarkerId (FK), sex, min/max_value       │
└───────────────────────────────────────────────────────────┘
```

#### Dicionário de Tabelas Principais:
1. **`user` / `session` / `account` / `verification`**: Gerenciadas pelo Better Auth para autenticação segura.
2. **`medv2_profile`**: Anamnese clínica completa (antropometria, hábitos, digestão, sono, cronotipo, histórico familiar).
3. **`medv2_settings`**: Preferências do usuário, modelos LLM selecionados e chaves locais.
4. **`medv2_document` & `medv2_document_blob`**: Metadados do exame (`blood-test` ou `bioimpedance`) e integridade física do arquivo PDF (SHA-256, mime, tamanho).
5. **`medv2_analysis` & `medv2_analysis_annotation`**: Histórico versionado de análises geradas por IA (`payload` JSONB integral) e anotações do usuário.
6. **`medv2_biomarker_definition`**: Dicionário canônico de biomarcadores (código único, aliases em JSONB, unidade padrão).
7. **`medv2_reference_range`**: Faixas de referência auditadas por faixa etária e sexo biológico.
8. **`medv2_analysis_biomarker`**: Tabela desnormalizada e tipada para indexação e consultas rápidas de evolução temporal.
9. **`medv2_operation`**: Controle transacional de idempotência e locks otimistas (`leaseUntil`).
10. **`medv2_exercise` & `medv2_exercise_media`**: Catálogo global de exercícios e mídias JPG/GIF armazenadas no PostgreSQL.
11. **`medv2_audit_event` & `medv2_migration_issue`**: Trilha de auditoria e registro de inconsistências em migrações.

---

## 7. Modelos de Dados Zod e Tipos Canônicos

### 7.1 Análise Clínica e Resposta da IA (`analysis.ts`)
```typescript
// Estrutura do item de suplementação
export const SupplementationItemSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  dose: z.string(),
  frequency: z.string()
});

// Refeição estruturada
export const MealItemSchema = z.object({
  name: z.string(),
  time: z.string(),
  description: z.string(),
  proteinGrams: z.coerce.number(),
  fatGrams: z.coerce.number(),
  carbsGrams: z.coerce.number()
});

// Alertas determinísticos puros
export const DeterministicAlertSchema = z.object({
  biomarker: z.string(),
  value: z.any(),
  unit: z.string(),
  optimalRange: z.string(),
  severity: z.enum(["info", "warning", "danger"]),
  insight: z.string(),
  protocol: z.string(),
  source: z.string()
});

// Contrato de resposta do LLM via OpenRouter
export const AnalysisLLMResponseSchema = z.object({
  healthStatus: z.string(),
  supplementation: z.array(SupplementationItemSchema).default([]),
  nutritionPlan: WeekdaysNutritionSchema,
  trainingPlan: WeekdaysSchema,
  nutritionOrientation: z.string().default(""),
  trainingOrientation: z.string().default("")
});
```

### 7.2 Biomarcadores e Bioimpedância (`biomarkers.ts`)
```typescript
export const BiomarkerItemSchema = z.object({
  name: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().nullish().transform(val => val || ""),
  referenceRange: z.string().nullish().transform(val => val || ""),
  status: z.enum(["normal", "alto", "baixo", "alterado"]).nullish().transform(val => val || "normal")
});

export const BioimpedanceResultSchema = z.object({
  dataExame: z.string().nullable().default(null),
  altura: z.coerce.number().nullable().default(null),
  peso: z.coerce.number().nullable().default(null),
  massaMagra: z.coerce.number().nullable().default(null),
  imc: z.coerce.number().nullable().default(null),
  inbodyScore: z.coerce.number().nullable().default(null),
  percentualGordura: z.coerce.number().nullable().default(null),
  massaGordura: z.coerce.number().nullable().default(null),
  aguaCorporal: z.coerce.number().nullable().default(null),
  proteina: z.coerce.number().nullable().default(null),
  minerais: z.coerce.number().nullable().default(null),
  taxaMetabolicaBasal: z.coerce.number().nullable().default(null),
  relacaoCinturaQuadril: z.coerce.number().nullable().default(null),
  nivelGorduraVisceral: z.coerce.number().nullable().default(null)
});
```

### 7.3 Configurações (`settings.ts`)
```typescript
export const SettingsSchema = z.object({
  openrouterApiKey: z.string().default(""),
  modelExtraction: z.string().default("google/gemini-2.5-flash"),
  modelAnalysis: z.string().default("google/gemini-2.5-pro"),
  lens: z.enum(["longevidade", "convencional", "performance"]).default("longevidade"),
  lensLongevidade: z.string().optional(),
  lensConvencional: z.string().optional(),
  lensPerformance: z.string().optional()
});
```

---

## 8. Taxonomia de Erros e Padrões de Retorno

O sistema não propaga exceções descontroladas para o cliente. Toda falha de negócio ou infraestrutura é mapeada para o tipo canônico `OperationError`:

```typescript
export type OperationCategory =
  | "validation"      // HTTP 400 - Entrada inválida contra schema Zod
  | "authorization"   // HTTP 403 / 401 - Falha de sessão
  | "conflict"        // HTTP 409 - Conflito de versão ou idempotência
  | "rate_limit"      // HTTP 429 - Limite de requisições excedido no upstream
  | "upstream"        // HTTP 502 - Falha de rede/resposta na OpenRouter
  | "internal";       // HTTP 500 - Erro inesperado / falha de I/O de disco

export interface OperationError {
  code: string;
  category: OperationCategory;
  message: string;
  hint?: string;
  retryable: boolean;
  invalidFields?: string[];
}
```

### 8.1 Regras de Observabilidade e Logs
- **Logs Sanitizados**: Os logs de erro registram estritamente: `requestId`, `code`, `category` e `retryable`.
- **Privacidade Obrigatória**: Prompts enviados ao LLM, respostas brutas, payloads de exames, CPF/nomes e chaves de API **JAMAIS** são gravados em logs ou expostos em mensagens de erro HTTP.

---

## 9. Diretrizes de Interface e Design System (UI/UX)

O MedV2 segue a linguagem visual do **Paridade Risco** com a voz de ação em **Laranja**.

### 9.1 Princípio Norte: Painel de Evidência
- Interface sóbria, operacional, precisa e focada no controle de saúde, sem parecer hospitalar nem fitness gamificada.
- **Regra Fundamental**: `Orange Means Action`. O laranja é reservado exclusivamente para botões de ação primária, seleção ativa, foco e navegação. **Nunca usar laranja para indicar severidade clínica, perigo ou sucesso**.

### 9.2 Tokens Semânticos e Cores (OKLCH)
- **Fundo Operacional**: `operational-graphite` (`oklch(0.18 0.008 275)`)
- **Painéis e Superfícies**: `panel-slate` (`oklch(0.22 0.01 275)`), `inset-graphite` (`oklch(0.195 0.008 275)`)
- **Ação**: `action-orange` (`oklch(0.72 0.18 55)`), `action-orange-strong` (`oklch(0.64 0.19 48)`)
- **Texto**: `text-clear` (`oklch(0.97 0.005 75)`), `text-muted` (`oklch(0.70 0.014 275)`), `text-soft` (`oklch(0.52 0.014 275)`)
- **Estados Clínicos**:
  - `success-green` (`oklch(0.72 0.17 145)`): Normal, meta atingida, evolução favorável.
  - `warning-amber` (`oklch(0.78 0.16 78)`): Atenção clínica, valor limítrofe, requer acompanhamento.
  - `danger-red` (`oklch(0.64 0.21 25)`): Risco clínico agudo, alteração severa ou ação destrutiva.
  - `info-blue` (`oklch(0.72 0.12 245)`): Informativo neutro ou valor abaixo da referência.

### 9.3 Tipografia e Layout
- **Sans-serif de sistema**: Leitura contínua, parágrafos explicativos e textos de orientação.
- **Monospaced (`ui-monospace`)**: Valores de exames, números, unidades, datas, códigos e scores.
- **Largura Máxima**: Conteúdo principal centralizado limitado a `760px`.
- **Acessibilidade**: Conformidade com WCAG AA. Alertas clínicos nunca dependem unicamente da cor: sempre acompanhados de label textual explícito e ícone.

---

## 10. Proibições Categóricas (Invioláveis)

Para manter a integridade arquitetural e a segurança clínica, as seguintes ações são **estritamente proibidas**:

### Proibições de Arquitetura e Código
1. 🚫 **PROIBIDO** importar Express, `process.env`, `fs`, `node:crypto` ou `fetch` dentro de arquivos em `backend/src/core/`. O core é isolado e puro.
2. 🚫 **PROIBIDO** expor endpoints que recebam caminhos de arquivo absolutos do cliente. Arquivos devem ser referenciados exclusivamente por IDs canônicos.
3. 🚫 **PROIBIDO** editar arquivos gerados manualmente em `frontend/dist/`. Todo código do cliente reside em `frontend-react/src/` e é compilado pelo Vite.
4. 🚫 **PROIBIDO** realizar bypass de validação Zod ou aplicar *type casting* descuidado (`as any`) em payloads desconhecidos vindos de I/O ou banco.
5. 🚫 **PROIBIDO** persistir novos formatos de biomarcadores ou faixas de referência sem passar pelas regras de normalização canônica (`BiomarkerPersistence`).

### Proibições de Segurança e Dados
6. 🚫 **PROIBIDO** alterar o bind de escuta padrão do servidor para interfaces não-loopback (`0.0.0.0`) fora do ambiente Docker explicitamente autorizado por `MEDV2_CONTAINER=true`.
7. 🚫 **PROIBIDO** incluir dados sensíveis do paciente (PHI), textos completos de exames ou chaves privadas nos logs do servidor.
8. 🚫 **PROIBIDO** permitir acesso a rotas de domínio clínico sem validação de sessão ativa do Better Auth ou sem aplicar o filtro de usuário no PostgreSQL via RLS (`app.user_id`).

### Proibições de Design e UI
10. 🚫 **PROIBIDO** usar gradientes decorativos, texto em gradiente ou efeitos de glassmorphism.
11. 🚫 **PROIBIDO** usar a cor Laranja para comunicar estados de alerta clínico, perigo ou sucesso. Laranja significa unicamente **ação**.
12. 🚫 **PROIBIDO** utilizar sombras pesadas ou botões circulares fora do padrão geométrico estabelecido (raio de 8px para botões, 4px para campos).

---

## 11. Scripts e Comandos Operacionais

| Comando | Descrição |
|---|---|
| `npm run check` | **Gate principal**: Executa typecheck (server + frontend), suíte de testes e builds completos. |
| `npm run typecheck` | Executa a verificação estática de tipos do backend e frontend. |
| `npm test` | Executa testes unitários e de integração do backend (`tsx --test`) e frontend (`vitest`). |
| `npm run dev` | Inicia simultaneamente API Express (`127.0.0.1:3000`) e Vite (`127.0.0.1:5173`). |
| `npm run build` | Compila o backend (`tsc`) e o frontend React para `frontend/dist/`. |
| `npm run db:migrate` | Executa as migrações SQL pendentes em `db/migrations/`. |
| `npm run db:bootstrap` | Cria o primeiro usuário administrador local via linha de comando. |
| `npm run db:reset-password` | Redefine a senha de um usuário local com invalidação de sessões. |
| `npm run db:backfill-biomarkers` | Popula as tabelas relacionais de biomarcadores a partir do histórico de análises. |
| `npm run db:import-json` | Importa dados e históricos legados em formato JSON para o banco PostgreSQL. |
| `npm run db:import-exercises` | Importa o módulo `EXDB`, instruções localizadas e mídias JPG/GIF para o catálogo PostgreSQL. |
