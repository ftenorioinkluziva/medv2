# Arquitetura e contratos operacionais

## Decisão

O MedV2 usa uma capacidade central com as interfaces que possuem consumidores confirmados:

- `core`: regras clínicas, parsing, geração, busca e autorização do handoff;
- API HTTP local: consumida pela SPA;
- API REST OpenGym: handoff e leitura do contrato de treino;
- PostgreSQL e armazenamento local: histórico, configuração, grants e documentos.

CLI, MCP, fila, orquestrador e banco remoto não foram adicionados porque não há consumidor ou requisito atual que os justifique.

## Fluxo

```text
SPA / OpenGym
      |
      v
Express adapter (parse + contexto privado + tradução HTTP)
      |
      v
Use case (regra + efeito + Result<Output, OperationError>)
      |
      v
Ports (database, files, LLM, PDF, KB, catalog, grants, runtime)
      |
      v
Adapters locais / OpenRouter
```

O core não lê `process.env`, não usa Express, não chama filesystem diretamente, não faz `fetch` e não escreve em console.

## Contratos das operações

| Operação | Input público | Contexto privado | Efeito | Idempotência/reconciliação | Autorização/consentimento |
|---|---|---|---|---|---|
| `update_settings` | modelos, lente e credencial fornecida legitimamente pelo usuário local | persistência | `reversible_write` | substituição integral validada | aplicação vinculada a loopback |
| `update_profile` | `ProfileSchema` | persistência | `reversible_write` clínico | substituição integral validada | aplicação vinculada a loopback |
| `update_annotations` | analysis ID + texto limitado | persistência | `reversible_write` | update por ID | recurso precisa existir |
| `process_document` | tipo, nome e PDF até 15 MB | credencial OpenRouter, perfil, relógio, adapters | escrita clínica composta + chamada externa | sem retry automático; rollback e compensação local | ação explícita de upload pelo usuário |
| `create_handoff` | `consent: true` | segredo HMAC, identidade local, relógio | `external_write` de autorização | grant único com UUID e expiração de 5 min | consentimento obrigatório |
| `get_workout_contract` | headers de subject/contract ID | token de serviço | leitura clínica sensível | leitura repetível durante a validade | token constante + grant vinculado a subject/contract |

O processamento de PDF permanece síncrono porque o consumidor atual aguarda o resultado e não há requisito demonstrado de retomada após desconexão. Se a duração passar a exceder os limites do transporte ou exigir retry durável, deve migrar para `start/status/result`, não para retries no navegador.

## Erros

Falhas esperadas seguem:

```ts
type OperationError = {
  code: string;
  category: "validation" | "authorization" | "conflict" | "rate_limit" | "upstream" | "internal";
  message: string;
  hint?: string;
  retryable: boolean;
  invalidFields?: string[];
};
```

A API responde `{ success: false, error: OperationError }`. O adapter OpenRouter classifica credencial, rate limit, indisponibilidade e output inválido. Escritas e validações não são repetidas automaticamente.

## Persistência e efeitos

- Toda leitura desconhecida de JSON passa por Zod.
- PostgreSQL usa transações e RLS com `app.user_id`; PDFs usam staging, hash, rename atômico e reconciliação, pois não participam de uma transação distribuída.
- Atualizações compostas de análise/documento e perfil/documento preservam snapshots para rollback.
- O arquivo PDF só é persistido depois do processamento e é removido se o commit dos metadados falhar.
- IDs usam UUID, evitando colisões por timestamp.
- Upload/processamento usa `Idempotency-Key` por usuário e persiste o estado da operação para evitar chamadas LLM duplicadas.
- Grants são persistidos, expiram e são vinculados ao par `contractId + subject`.

## Dados sensíveis e observabilidade

- A chave OpenRouter é acessível somente pelo adapter LLM através de um port de credencial.
- O core recebe configuração de modelo sem o secret.
- A resposta da OpenRouter, prompts, PDFs e dados clínicos não são enviados aos logs.
- Logs de erro usam somente request ID, código, categoria e retry.
- PDFs são recuperados por ID; o caminho físico nunca é aceito do cliente.

## Evoluções condicionais

Não são defeitos atuais:

- autenticação multiusuário e banco transacional, se o app deixar de ser estritamente local;
- worker/fila e estado durável, se o processamento precisar sobreviver à conexão;
- CLI ou MCP, se surgir consumidor humano/script/agente local confirmado;
- rate limiting no gateway, se houver publicação remota.

## Container local

`docker-compose.local.yml` mantém o mesmo contrato HTTP, adiciona PostgreSQL persistente e separa estado e exposição:

- o processo escuta em `0.0.0.0:3000` somente dentro da rede do container;
- a porta é publicada no host como `127.0.0.1:3011` por padrão;
- `MEDV2_CONTAINER=true` é necessário para autorizar o bind não-loopback interno;
- dados e uploads ficam em volumes nomeados isolados do checkout;
- PostgreSQL fica no volume `medv2_postgres` e só é exposto no loopback para desenvolvimento;
- somente as bases de conhecimento versionáveis entram na imagem;
- `.env`, perfil, análises, documentos e PDFs do host são excluídos do build context;
- filesystem raiz somente leitura, `/tmp` limitado e `no-new-privileges` reduzem efeitos acidentais;
- o healthcheck exercita a API pela rede interna do container.
