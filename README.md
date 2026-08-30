# MedV2 — Analisador local de exames e saúde

Aplicação local para extrair dados de PDFs de exames de sangue e bioimpedância, calcular marcadores determinísticos e gerar análises estruturadas por meio da OpenRouter.

> O conteúdo gerado é informativo e não substitui avaliação, diagnóstico ou prescrição por profissional habilitado.

## Execução

Requisitos: Node.js 20 ou superior, npm e PostgreSQL 16 (ou Docker).

```powershell
Copy-Item .env.example .env
npm install
npm run db:migrate
npm start
```

A aplicação fica disponível somente na interface local:

```text
http://127.0.0.1:3000
```

O servidor é deliberadamente vinculado a `127.0.0.1`. Publicação remota exige uma decisão arquitetural separada com autenticação, autorização e TLS; não altere apenas o host de escuta.

## Configuração

Variáveis suportadas:

- `PORT`: porta local, padrão `3000`;
- `OPENROUTER_API_KEY`: fallback para a credencial configurada pela interface;
- `MEDV0_HANDOFF_SECRET`: assinatura dos tokens curtos de handoff OpenGym;
- `MEDV0_SERVICE_TOKEN`: credencial privada do consumidor do contrato OpenGym;
- `DATABASE_URL`: conexão PostgreSQL;
- `BETTER_AUTH_SECRET`: segredo de sessão do Better Auth;
- `BETTER_AUTH_URL`: origem confiável da aplicação.

Credenciais reais ficam em `.env` ou no armazenamento local de configurações e nunca são retornadas integralmente pela API. `.env`, dados pessoais, grants e uploads estão excluídos do versionamento.

## Estrutura

```text
backend/src/core/
  schemas/       contratos canônicos validados em runtime
  ports/         dependências externas requeridas pelos casos de uso
  use-cases/     operações e orquestração de negócio
  services/      regras determinísticas puras
  types/         Result e OperationError

backend/src/adapters/
  database/      PostgreSQL, pool, adapter e importador JSON
  exercise/      catálogo local de exercícios
  handoff/       grants persistidos e assinatura HMAC
  knowledge/     leitura validada das bases de conhecimento
  llm/           integração OpenRouter e tradução de falhas
  pdf/           extração de PDF
  runtime/       relógio e geração de IDs
  storage/       armazenamento privado de PDFs

backend/src/server.ts
  composition root e adaptador HTTP Express

frontend-react/
  SPA React + TypeScript compilada pelo Vite

frontend/dist/
  build estático servido pelo Express (gerado, não editado manualmente)
```

As decisões arquiteturais, contratos e política de efeitos estão em [`docs/architecture.md`](docs/architecture.md).

## Gates

```powershell
npm run typecheck
npm test
npm run build
npm run check
```

`npm run check` executa typecheck, testes determinísticos/HTTP e build. Os testes cobrem contratos inválidos, persistência inválida, taxonomia de retry, compensação de upload, segredo mascarado, CORS, sessão Better Auth e autorização do handoff.

## Desenvolvimento do frontend

O modo de desenvolvimento inicia a API em `127.0.0.1:3000` e o Vite em `127.0.0.1:5173`, com proxy de `/api` para o backend:

```powershell
npm run dev
```

Para executar separadamente:

```powershell
npm run dev:server
npm run dev:frontend
```

O build de produção compila backend e frontend. O Express serve somente o resultado em `frontend/dist`:

```powershell
npm run build
npm start
```

## Docker Compose local

O stack Docker de testes é isolado da execução direta e usa a porta `3011` por padrão:

```powershell
docker compose -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.local.yml logs -f app
```

Acesse `http://127.0.0.1:3011`. Para usar outra porta livre:

```powershell
$env:MEDV2_DOCKER_PORT = '3020'
docker compose -f docker-compose.local.yml up -d
```

O Compose lê as credenciais do `.env` local e as injeta como variáveis; o arquivo não entra na imagem. O stack possui aplicação e PostgreSQL persistente. Os dados clínicos e uploads existentes no host não entram na imagem. O container usa volumes nomeados próprios:

- `medv2-local_medv2_postgres`;
- `medv2-local_medv2_data`;
- `medv2-local_medv2_uploads`.

Parar preservando os dados de teste:

```powershell
docker compose -f docker-compose.local.yml down
```

Remover também os dados isolados de teste:

```powershell
docker compose -f docker-compose.local.yml down -v
```

O último comando remove definitivamente somente os volumes deste Compose.

## Segurança e dados

- PDFs têm limite de 15 MB, MIME e assinatura `%PDF-` verificados.
- Uploads não são publicados como diretório estático.
- Um documento é lido pela rota controlada `GET /api/documents/:id/file`.
- Logs contêm somente request ID, código, categoria e retry; respostas clínicas e secrets não são registrados.
- O handoff exige consentimento explícito. A leitura do contrato exige token de serviço e um grant correspondente, não expirado, para `contractId + subject`.
- No host, a aplicação direta escuta em loopback. No container, ela escuta na rede interna e o Compose publica a porta apenas em `127.0.0.1`.
- PostgreSQL é a fonte de verdade do estado clínico após migração. O volume de PDFs usa staging, hash, rename atômico e reconciliação; não é tratado como parte de uma transação distribuída.
- As rotas clínicas exigem sessão Better Auth e filtram todos os recursos por usuário.
- Uploads exigem `Idempotency-Key` para evitar chamadas LLM duplicadas.
- O JSON completo da análise é preservado como evidência; biomarcadores também são indexados em tabelas estruturadas para histórico e filtros.

## Bootstrap e migração

Para criar o primeiro usuário:

```powershell
$env:MEDV2_BOOTSTRAP_EMAIL = 'voce@example.com'
$env:MEDV2_BOOTSTRAP_PASSWORD = 'uma-senha-com-8-ou-mais-caracteres'
npm run db:bootstrap
```

Para redefinir a senha de um usuário existente sem expor a nova senha no
histórico do projeto, defina as variáveis somente na sessão local do terminal:

```powershell
$env:MEDV2_RESET_EMAIL = 'bootstrap2@example.com'
$env:MEDV2_RESET_PASSWORD = 'defina-uma-nova-senha-local'
npm run db:reset-password
Remove-Item Env:MEDV2_RESET_EMAIL, Env:MEDV2_RESET_PASSWORD
```

O comando atualiza o hash da conta por senha e encerra as sessões existentes.

Para importar os JSON legados para esse usuário, use o `userId` retornado pelo bootstrap:

```powershell
$env:MEDV2_IMPORT_USER_ID = 'id-do-usuario'
npm run db:import-json
```

O importador preserva os JSON, arquivos e IDs; vínculos ambíguos são registrados em `medv2_migration_issue`.

Para preencher a camada estruturada de biomarcadores de uma base já existente:

```powershell
npm run db:migrate
npm run db:backfill-biomarkers
```

O backfill cria definições canônicas e valores por análise. Faixas clínicas não são inferidas automaticamente: o texto original permanece em cada medição até que uma fonte versionada e aprovada seja cadastrada em `medv2_reference_range`.

## Adicionando uma operação

1. Defina input, output e erro em `core/schemas`.
2. Adicione um port somente se houver dependência externa real.
3. Implemente o caso de uso sem Express, filesystem, `process.env` ou output de terminal.
4. Faça o adapter traduzir protocolo para o contrato do core.
5. Adicione testes de sucesso, input inválido, falha esperada, retry e efeitos.
6. Execute `npm run check` e um smoke test pela interface consumidora.
