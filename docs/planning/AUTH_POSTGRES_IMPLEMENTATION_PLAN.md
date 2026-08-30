# Plano imediato: autenticação e PostgreSQL

> Status: implementação inicial concluída e validada localmente. Pendências de evolução: reconciliação automática de arquivos órfãos, auditoria detalhada de eventos e processamento assíncrono caso o tempo real da LLM ultrapasse o transporte.

## Objetivo

Transformar o MedV2 de uma aplicação local single-user em uma aplicação autenticada e multiusuário, mantendo o Express, o core atual e o armazenamento privado dos PDFs. O PostgreSQL será executado no mesmo `docker compose` da aplicação, com volume nomeado persistente.

## Estado atual mapeado

- Não existe autenticação, sessão ou usuário. Todas as rotas da API estão acessíveis sem login.
- `JsonDatabaseAdapter` persiste estado global em `data/profile.json`, `data/settings.json`, `data/analyses.json` e `data/documents.json`.
- `JsonHandoffGrantAdapter` persiste grants em `data/handoff-grants.json`.
- PDFs são gravados em `uploads/<document-id>.pdf`; o caminho não é exposto diretamente.
- As bases `*_kb.json` e `backend/data/exercises.json` são catálogo/base de conhecimento somente leitura e não devem migrar para tabelas de dados do usuário nesta etapa.
- O Compose sobe somente `app`; não há serviço PostgreSQL nem `DATABASE_URL`.
- A chave OpenRouter pode hoje ser gravada em `settings.json`; isso não deve continuar como segredo em texto puro por usuário.

## Escopo funcional de autenticação

### Primeira entrega

- Login por e-mail e senha com Better Auth.
- Criação de conta, encerramento de sessão e consulta da sessão atual.
- Cookie de sessão HttpOnly, SameSite adequado ao mesmo domínio e `credentials` no frontend.
- Proteção de todas as rotas clínicas e de configuração.
- Retorno `401 UNAUTHORIZED` para chamadas sem sessão.
- Isolamento obrigatório por `user_id` em todas as consultas e mutações.
- Página de login e estado de sessão no frontend.
- Limitação de tentativas de login e resposta sem exposição de existência de conta.
- Auditoria sanitizada de sucesso, falha e encerramento de sessão.

### Fora da primeira entrega

- OAuth social, organização/equipe, papéis administrativos e passkeys.
- Recuperação de senha e envio de e-mail, caso ainda não exista provedor de e-mail configurado.
- Compartilhamento clínico entre usuários.

Esses itens podem ser adicionados depois sem alterar o vínculo principal dos dados, desde que o usuário continue sendo a raiz de autorização.

## Decisões arquiteturais obrigatórias

- O runtime será migrado de CommonJS para ESM antes da integração do Better Auth. O `tsconfig.json` atual usa `module: commonjs`, enquanto a integração oficial do Better Auth com Express exige ESM.
- A identidade autenticada será contexto privado criado pelo middleware. `userId` nunca será aceito do body, query string ou header controlado pelo cliente.
- O isolamento terá duas camadas: repositories/use cases sempre filtram por `user_id`, e PostgreSQL terá Row-Level Security nas tabelas clínicas quando a conexão de aplicação estiver ativa.
- A unidade de autorização do handoff será o `user_id` proprietário do grant, não o `subject` recebido pelo consumidor externo.
- A chave OpenRouter será única e operacional, fornecida por `OPENROUTER_API_KEY`. A configuração por usuário fica fora da primeira versão e o campo atual será removido do contrato persistente.
- O PostgreSQL será a fonte de verdade após a migração. O adapter JSON será usado somente pelo importador e por fixtures de testes, nunca como fallback silencioso de produção.
- A transação do PostgreSQL não será apresentada como transação do PDF. A consistência entre banco e volume será tratada por protocolo de staging, rename, status e reconciliação.

## Modelo de persistência proposto

### Tabelas do Better Auth

Usar as tabelas oficiais geradas pelo Better Auth: `user`, `session`, `account` e `verification`. Não duplicar usuário ou sessão em tabelas próprias.

### Tabelas do domínio

| Tabela | Conteúdo | Relações e regras |
|---|---|---|
| `medv2_profile` | Perfil, medidas, cardio, objetivos, condições, medicamentos, alergias, cirurgias, sono, hábitos, anamnese nutricional e de exercício hoje representados pelo `ProfileSchema` | `user_id` PK/FK para `user`; um perfil por usuário; `updated_at`; não apagar junto com histórico sem confirmação explícita |
| `medv2_settings` | Lente, modelos e textos `lens*` atualmente em `settings.json` | `user_id` PK/FK; um registro por usuário; `openrouter_api_key` não entra nesta tabela em texto puro |
| `medv2_document` | Metadados de PDF: id, nome, tipo, data do exame, status, nome original, filename físico, upload e timestamps | FK `user_id`; índice `(user_id, date DESC)`; `filename` é interno; não aceitar caminho vindo do cliente |
| `medv2_document_blob` | Hash SHA-256, tamanho, MIME, chave física, estado do arquivo e timestamps | Obrigatória 1:1 com documento; manter PDF no volume privado, não em `bytea`; estados `staged`, `available`, `missing`, `quarantined` |
| `medv2_analysis` | Análise imutável e versionada: status de saúde, orientações, planos, alertas e payload estruturado | FK `user_id` e `document_id`; `version`, `status`, `schema_version`, `input_fingerprint`, `model`, `lens`, `payload jsonb`; índice por usuário/data/status; `created_at` imutável |
| `medv2_analysis_annotation` | Anotações editáveis da análise | FK `analysis_id` e `user_id`; uma anotação atual por análise na primeira versão; `updated_at`; validar que análise pertence ao mesmo usuário |
| `medv2_handoff_grant` | `contract_id`, subject, criação, expiração, último acesso e estado do handoff OpenGym | FK `user_id`; `contract_id` UNIQUE; índice de expiração; estados `active`, `expired`, `revoked`; grant expirado/revogado não autoriza leitura |
| `medv2_operation` | Idempotência e estado de operações de upload/processamento | UNIQUE `(user_id, idempotency_key)`; fingerprint da entrada, estado, resultado, tentativa, lease e erro terminal |
| `medv2_migration_issue` | Pendências de importação, vínculos ambíguos, órfãos e falhas de validação | Não bloquear a importação de outros registros; cada item deve ter origem, motivo, status e resolução |
| `medv2_audit_event` | Auditoria mínima de login, logout, criação/alteração de perfil, upload, processamento, leitura de PDF e handoff | `user_id` nullable para eventos pré-login; guardar ação, recurso, resultado, request id e timestamp; nunca guardar PDF, prompt, resposta LLM, token ou segredo |

### Dados que permanecem fora do PostgreSQL

- PDFs: volume privado `medv2_uploads`, referenciado por `medv2_document`.
- Bases clínicas compiladas: `data/katia_haranaka_kb.json`, `data/guilherme_freccia_kb.json` e `data/nutricao_kb.json`.
- Catálogo de exercícios: `backend/data/exercises.json`.
- Segredos operacionais: `.env`/secret manager (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `OPENROUTER_API_KEY`, `MEDV0_*`).

### Constraints e ownership

- Todas as tabelas clínicas têm `user_id NOT NULL`, exceto eventos explicitamente pré-login.
- `medv2_analysis.document_id` deve apontar para documento do mesmo `user_id`; usar constraint composta ou validação transacional equivalente.
- `medv2_analysis_annotation` só pode apontar para análise do mesmo usuário.
- `medv2_handoff_grant` só pode ser consumido para o proprietário registrado no grant.
- RLS deve negar acesso por padrão e ser exercitada em testes com dois usuários.

## Contratos operacionais

Cada operação deve possuir schema de input/output e erros estáveis no core ou no gateway de aplicação. Credenciais e identidade ficam no contexto privado.

| Operação | Input público | Contexto privado | Efeito/idempotência | Autorização |
|---|---|---|---|---|
| `sign_up` | e-mail, senha, nome opcional | Better Auth, request id | escrita de identidade; conflito por e-mail; sem retry cego | registro permitido pela política de ambiente |
| `sign_in` | e-mail, senha | Better Auth, request id, rate limiter | escrita de sessão; não repetir automaticamente | credencial válida e conta ativa |
| `sign_out` | nenhum | sessão atual | escrita reversível; idempotente | sessão atual |
| `get_session` | nenhum | cookie HttpOnly | leitura | sessão atual |
| `update_profile` | `ProfileSchema` | `userId`, request id | substituição validada; idempotência por estado atual | próprio usuário |
| `update_settings` | modelos/lente, sem chave secreta | `userId`, configuração operacional | substituição validada; não persiste segredo | próprio usuário |
| `upload_document` | PDF, `docType`, `Idempotency-Key` | `userId`, parser, LLM, storage, request id | operação reconciliável; status persistido | próprio usuário |
| `update_analysis_annotations` | analysis ID, texto | `userId`, request id | escrita reversível; update por recurso | análise do próprio usuário |
| `create_handoff` | consentimento explícito | `userId`, assinatura, clock | escrita externa/autorização; `contractId` único; não repetir sem reconciliação | próprio usuário e consentimento `true` |
| `get_workout_contract` | contract ID e subject do contrato | token de serviço, grant, request id | leitura sensível; sem retry de autorização | token válido + grant ativo + ownership do grant |

Erros devem usar a taxonomia existente (`validation`, `authorization`, `conflict`, `rate_limit`, `upstream`, `internal`) com `code`, `retryable`, `hint` e campos inválidos quando aplicável.

## Mapeamento das rotas

### Públicas

- `GET /health` (a criar ou preservar): saúde da aplicação e conectividade do banco, sem dados clínicos.
- `GET/POST /api/auth/*`: handler do Better Auth.
- `GET /api/health`: não deve revelar contagens, DSN, nomes de tabelas ou dados clínicos; pode retornar `db: connected|unavailable`.
- `GET /` e assets da SPA: podem carregar sem sessão, mas dados clínicos não.

### Protegidas por sessão

- `GET/POST /api/settings`
- `GET/POST /api/profile`
- `GET /api/documents`
- `GET /api/documents/:id/file`
- `GET /api/analyses`
- `GET /api/analyses/:id`
- `POST /api/analyses/:id/annotations`
- `POST /api/upload-document`
- `POST /api/integrations/opengym/handoff`

### Proteção específica do handoff

`GET /api/integrations/opengym/workout/contract` continua exigindo o token de serviço e o grant válido, mas o grant também deve estar ligado ao `user_id` que o criou. Não confiar no `subject` recebido para descobrir ou trocar de usuário.

O endpoint externo não exige sessão de navegador, porque o OpenGym usa token de serviço. O adapter deve resolver o proprietário pelo `contract_id` e autorizar a leitura dentro desse grant; não deve tentar obter `user_id` a partir de header público.

`GET /api/exercises` e o acesso às bases de conhecimento podem permanecer públicos somente se forem realmente considerados catálogo não sensível; a implementação deve evitar que qualquer contexto clínico seja retornado junto.

## Arquitetura de implementação

1. Migrar o projeto para ESM e atualizar `package.json`, `tsconfig.json`, imports, build e execução.
2. Adicionar `better-auth`, `pg` e tipos do Node; configurar Better Auth com PostgreSQL e `BETTER_AUTH_SECRET`.
3. Criar schemas para `AuthContext`, contratos de operação, erros e estados de persistência.
4. Criar `PostgresDatabaseAdapter` implementando o `DatabasePort`, com contexto de usuário em todas as operações de domínio.
5. Criar middleware que chama `auth.api.getSession`, anexa o usuário autenticado e rejeita chamadas sem sessão antes dos casos de uso.
6. Montar o handler Better Auth antes de `express.json()`, com CORS explícito, `credentials: true` e preflight.
7. Refatorar os casos de uso para usar `userId` privado e repositories com ownership obrigatório.
8. Implementar migrações, constraints, RLS, advisory lock de migração e healthcheck do banco.
9. Implementar o protocolo arquivo–banco e a tabela de operações/idempotência antes do upload autenticado.
10. Implementar transações PostgreSQL somente para os registros relacionais; usar staging, rename atômico e reconciliação para PDFs.
11. Implementar bootstrap do primeiro usuário por comando/credencial explícita, sem usuário padrão na imagem.
12. Importar os JSON para o usuário escolhido, preservando IDs e emitindo relatório de reconciliação.
13. Remover o `JsonDatabaseAdapter` do composition root de produção; mantê-lo somente no importador e fixtures até o fechamento dos gates.

## Docker/PostgreSQL

Adicionar ao `docker-compose.local.yml`:

- serviço `db` baseado em `postgres:16-alpine`;
- volume nomeado `medv2_postgres`;
- `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` vindos do `.env`;
- healthcheck com `pg_isready`;
- `app` dependente de `db` saudável;
- `DATABASE_URL=postgresql://...@db:5432/...` somente dentro da rede Compose;
- migrações versionadas e idempotentes executadas por um único comando com advisory lock antes do app aceitar tráfego;
- exposição do PostgreSQL no host apenas se necessária para desenvolvimento, preferencialmente em `127.0.0.1` e porta configurável.

O volume do banco deve ser separado dos volumes `medv2_data` e `medv2_uploads`. `docker compose down` preserva dados; `down -v` será documentado como destrutivo.

O container da aplicação não deve iniciar em modo parcialmente migrado. O processo de migração deve falhar de forma explícita e impedir tráfego clínico até concluir.

## Protocolo de consistência arquivo–PostgreSQL

O processamento de PDF é uma operação composta, não uma transação distribuída. O protocolo mínimo é:

1. Validar PDF e calcular fingerprint antes de chamar a LLM.
2. Criar `medv2_operation` e documento em `staged` dentro do PostgreSQL.
3. Gravar o arquivo em nome temporário seguro no volume.
4. Validar tamanho, MIME, assinatura e SHA-256.
5. Renomear atomicamente para a chave final.
6. Atualizar o blob para `available` e a operação para `processing`/`completed` em transação.
7. Persistir análise e/ou atualização de perfil somente com vínculo ao documento e ao usuário.
8. Em falha, marcar a operação como terminal, remover o temporário e colocar registros/arquivos inconsistentes em reconciliação.

Um reconciliador deve detectar:

- arquivo sem registro;
- registro sem arquivo;
- blob `staged` vencido;
- análise sem documento disponível;
- operação presa em `processing`.

## Idempotência e duração

`POST /api/upload-document` exige `Idempotency-Key`. A chave fica vinculada a `user_id` e ao fingerprint da entrada. A mesma chave com fingerprint diferente retorna conflito.

O processamento deve ser síncrono somente enquanto os smoke tests demonstrarem que parsing + OpenRouter permanecem dentro dos limites do transporte real. Caso contrário, a API deve retornar `operationId` e expor `GET /api/operations/:id`; estado, tentativas, leases e resultado ficam no servidor.

## Migração dos dados existentes

1. Fazer cópia dos diretórios `data` e `uploads` antes da primeira execução.
2. Criar o usuário de migração com e-mail definido pelo operador.
3. Inserir perfil e configurações desse usuário.
4. Inserir documentos preservando `id` e `filename`.
5. Calcular correspondência de análise por `originalName + date` somente como tentativa; nunca usar nome como chave definitiva.
6. Preservar análises sem correspondência com `document_id = NULL` e registrar `medv2_migration_issue`.
7. Registrar como pendência toda duplicidade, arquivo ausente, documento sem análise e análise com documento ambíguo.
8. Inserir grants ainda válidos com o `user_id` do usuário de migração; grants expirados devem ser importados como `expired` ou omitidos com contagem registrada.
9. Validar contagens, IDs, hashes, arquivos físicos, ownership e leitura pela API autenticada.
10. Resolver pendências e só então tornar vínculos obrigatórios e alterar o composition root para PostgreSQL.

O importador deve ser executável novamente sem duplicar registros e sem apagar os JSON originais.

## Critérios de aceite

- Usuário A não consegue listar, ler, baixar, alterar ou processar dados de B, mesmo conhecendo IDs.
- Sem sessão, rotas clínicas respondem `401` com erro estruturado.
- Login, logout e sessão sobrevivem à reinicialização do container.
- PostgreSQL e aplicação sobem em conjunto em um checkout limpo.
- `profile`, `settings`, documentos, análises, anotações e grants sobrevivem a `docker compose restart`.
- Processamento falho não deixa documento órfão nem análise sem documento.
- Falhas entre volume e banco são reconciliáveis e não são apresentadas como transação atômica.
- Repetir o upload com a mesma chave não chama a LLM nem cria nova análise.
- A mesma chave com conteúdo diferente retorna conflito.
- O PDF baixado só pode ser resolvido após checagem de propriedade no banco.
- RLS/repositories impedem acesso cruzado mesmo quando o usuário conhece IDs válidos.
- Segredos não aparecem em respostas, logs, migrações, dumps de teste ou `jsonb` de análise.
- Análises concluídas são imutáveis, possuem versão/schema/input fingerprint e preservam o snapshot necessário para auditoria.
- `npm run typecheck`, `npm test`, `npm run build` e testes HTTP autenticados passam.
- A migração reporta contagens e falhas por entidade, sem apagar os JSON originais.
- Testes verificam cookie, `credentials`, preflight, rate limit básico, sessão expirada e logout.

## Ordem recomendada de execução

1. Decisão e migração ESM, contratos e `AuthContext`.
2. Infraestrutura Compose + PostgreSQL + migrations + advisory lock + healthcheck.
3. Constraints, RLS e adapter PostgreSQL com ownership.
4. Better Auth + tela/fluxo de login + middleware de sessão + cookies/CORS.
5. Protocolo arquivo–banco, `medv2_operation` e idempotência.
6. Migração dos JSON com relatório de reconciliação.
7. Upload/processamento e grants de handoff com ownership.
8. Testes de isolamento, restart, migração, secrets, reconciliação e smoke end-to-end.
9. Remoção do adapter JSON do runtime e atualização do README/arquitetura.

## Decisões adotadas na implementação inicial

- Login por e-mail e senha com Better Auth; OAuth fica fora do primeiro incremento.
- A chave OpenRouter permanece somente no ambiente do serviço (`OPENROUTER_API_KEY`); não é persistida por usuário.
- O primeiro usuário é criado por `npm run db:bootstrap`, sem usuário padrão embutido na imagem.
- O contrato OpenGym atual `medv0-opengym-workout/v1` foi preservado, mas sua leitura agora resolve o proprietário do handoff e aplica o isolamento correspondente.
- O runtime usa PostgreSQL como fonte de verdade; o adapter JSON permanece apenas como compatibilidade de migração/testes e não é usado pela composição principal.

## Evoluções pós-MVP

- Reconciliação automática dos PDFs quando houver falha entre filesystem e banco.
- Registro detalhado de eventos em `medv2_audit_event`.
- Processamento assíncrono caso o tempo real da LLM ultrapasse o transporte HTTP.
