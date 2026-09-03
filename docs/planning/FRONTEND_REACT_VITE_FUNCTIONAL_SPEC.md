# Especificação Funcional: Nova Experiência Web do MedV2

**Status:** proposta para implementação

**Escopo:** migração da SPA atual para React + TypeScript, com Vite no frontend

**Backend:** permanece Express, com os contratos HTTP e regras clínicas existentes

## 1. Objetivo

Entregar uma experiência de acompanhamento clínico local, mais previsível e modular, em que o usuário consiga:

1. entender rapidamente o estado atual;
2. trocar a análise de referência sem perder o contexto;
3. consultar análise, insights e planos sem navegar para uma página secundária;
4. acompanhar a evolução dos biomarcadores com controles compactos;
5. revisar documentos, perfil e configurações sem duplicar dados ou lógica.

A migração tecnológica não deve alterar o significado clínico, os cálculos, a persistência, os contratos de API ou as regras de segurança atuais.

## 2. Princípios da experiência

- **Decisão antes de exploração:** o Painel apresenta estado, atenção e próxima ação.
- **Uma página para a análise ativa:** o menu de análise detalhada fica acima do card de Estado de Saúde e alterna o conteúdo no próprio Painel.
- **Evidência visível:** data, exame de referência, valores, unidades e origem permanecem associados ao conteúdo.
- **Cor com função:** laranja indica ação, foco ou seleção. Não indica gravidade clínica.
- **Continuidade:** trocar de análise atualiza todos os componentes dependentes de forma consistente.
- **Segurança local:** erros de sessão, upload, API e processamento explicam como continuar sem expor credenciais ou conteúdo clínico em logs.

## 3. Arquitetura de informação

O shell autenticado contém cinco áreas principais:

| Área | Objetivo | Entrada principal |
|---|---|---|
| Painel | Estado atual, análise ativa, planos e documentos recentes | abertura padrão após login |
| Labs | Evolução histórica e comparação de biomarcadores | navegação principal |
| Sistemas | Pontuações e composição por sistemas | navegação principal |
| Perfil | Dados corporais e preferências do usuário | navegação principal |
| Histórico | Análises e documentos arquivados | navegação principal |

Configurações continuam acessíveis pelo botão do cabeçalho, sem se tornarem uma aba principal.

## 4. Shell da aplicação

### 4.1 Cabeçalho

O cabeçalho deve:

- exibir a marca MedV2;
- exibir saudação com o nome do paciente, quando disponível;
- oferecer acesso a Configurações;
- oferecer Sair;
- manter alvos de toque com pelo menos 40 px;
- permanecer funcional em viewport estreita.

### 4.2 Navegação principal

A navegação é composta por botões acessíveis, com estado ativo explícito:

`Painel`, `Labs`, `Sistemas`, `Perfil`, `Histórico`.

Em telas estreitas, a barra pode rolar horizontalmente, mas não deve quebrar linha nem ocultar o item selecionado.

### 4.3 Contexto da análise ativa

Quando houver pelo menos uma análise, o shell exibe um seletor de análise ativa com:

- data formatada;
- nome do exame de referência;
- ação “Ver mais recente” quando a análise selecionada não for a mais recente.

Alterar a análise ativa deve atualizar Painel, detalhe da análise, Labs, Sistemas e Histórico sem recarregar a página.

## 5. Painel principal

### 5.1 Ordem de leitura

Quando autenticado e com análise disponível, a ordem visual é:

1. seletor de análise ativa;
2. menu `ANÁLISE DETALHADA`;
3. conteúdo da seção detalhada selecionada;
4. card `Estado de Saúde` resumido;
5. pontuações de saúde;
6. meus planos;
7. documentos recentes e upload.

O card `Estado de Saúde` não deve conter a chamada `Ver análise detalhada →`. A navegação para os detalhes ocorre exclusivamente pelo menu acima dele.

### 5.2 Menu de análise detalhada

O menu é sempre parte do Painel quando existe uma análise ativa. Ele contém as opções:

- Estado de Saúde;
- Insights;
- Suplementação;
- Plano Alimentar;
- Treino.

Requisitos funcionais:

- a opção ativa tem destaque visual e semântico;
- cada opção é operável por teclado;
- a troca não altera a URL nem abre outra view;
- a troca preserva a análise ativa;
- a aba inicial é `Estado de Saúde`;
- em mobile, o menu pode rolar horizontalmente;
- o conteúdo deve receber foco lógico ou ser anunciado quando a troca ocorrer.

### 5.3 Estado de Saúde

O painel detalhado deve exibir:

- título `Estado de Saúde Geral (Análise de IA)`;
- texto renderizado da análise;
- exame de referência;
- data da análise ativa;
- aviso informativo de que o conteúdo não substitui avaliação profissional, quando aplicável.

O card resumido `Estado de Saúde` deve continuar apresentando uma síntese curta e a data, mas sem duplicar o link de navegação.

### 5.4 Insights

O painel de Insights deve:

- listar alertas determinísticos da análise ativa;
- exibir biomarcador, valor, unidade, faixa-alvo, fonte e explicação;
- identificar textualmente a severidade;
- diferenciar ausência de alertas de erro de carregamento;
- exibir estado vazio quando nenhum desvio for identificado.

Nenhuma severidade pode depender somente de cor.

### 5.5 Suplementação

O painel deve listar os suplementos da análise ativa com:

- nome;
- finalidade;
- dose;
- frequência;
- aviso educacional para consultar profissional habilitado antes de iniciar suplementação.

Sem itens, deve exibir `Nenhum suplemento prescrito para esta análise.`.

### 5.6 Plano Alimentar

O painel deve exibir:

- orientação nutricional geral, quando existir;
- seletor de dia da semana;
- conteúdo do dia selecionado;
- estado vazio para dia sem recomendação;
- compatibilidade com formatos legado em texto e estruturado por refeições.

Trocar o dia não deve trocar a análise ativa.

### 5.7 Treino

O painel deve exibir:

- orientação geral de treino, quando existir;
- seletor de dia da semana;
- conteúdo do dia selecionado;
- estado de descanso ou ausência de treino;

## 6. Labs: evolução de biomarcadores

### 6.1 Seleção de painéis

A tela deve substituir a parede vertical de botões por selects agrupados:

- Painéis Clínicos Principais;
- Painéis Derivados e Co-fatores;
- Painéis Hormonais;
- Painéis de Micronutrientes.

Selecionar um painel deve:

- atualizar os marcadores selecionados;
- atualizar a explicação clínica;
- redesenhar o gráfico;
- atualizar a lista de marcadores avaliados;
- preservar a análise ativa.

### 6.2 Gráfico

O gráfico deve:

- renderizar evolução por data;
- tratar ausência de um marcador em determinada coleta;
- exibir legenda legível;
- apresentar estado vazio quando não houver dados;
- adaptar-se a mobile sem cortar datas ou valores;
- comunicar tendências sem afirmar diagnóstico ou causalidade.

### 6.3 Histórico tabular

A tabela deve manter:

- biomarcador;
- unidade;
- valores por data;
- status textual quando disponível;
- rolagem horizontal controlada em mobile.

### 6.4 Anotações

O usuário pode associar à coleta:

- tags de contexto;
- horário da coleta;
- observações adicionais.

Salvar deve indicar sucesso ou erro e manter o conteúdo digitado em caso de falha.

## 7. Sistemas de Saúde

A tela deve exibir as pontuações por sistema e seus detalhes. O comportamento deve permanecer equivalente ao atual, com componentes React independentes para:

- pontuação;
- estado textual;
- marcadores associados;
- explicação do sistema.

Pontuações não devem ser interpretadas como diagnóstico.

## 8. Perfil

O Perfil deve permitir consultar e atualizar:

- idade;
- sexo;
- altura;
- peso;
- massa magra;
- preferências e sensibilidades alimentares;
- notas nutricionais.

Após salvar, o Painel deve refletir os dados atualizados sem reload completo.

## 9. Histórico

O Histórico deve conter duas listas:

1. análises anteriores;
2. documentos enviados.

Selecionar uma análise deve torná-la a análise ativa e retornar ao Painel, onde o menu detalhado será atualizado. Visualizar PDF deve abrir somente a rota protegida existente.

## 10. Upload de documentos

O fluxo deve preservar:

- seleção ou arraste de PDF;
- escolha entre exame de sangue e bioimpedância;
- validação visual do arquivo;
- indicador de processamento;
- prevenção de submissão duplicada;
- mensagem de erro acionável;
- atualização de documentos e análise após sucesso.

Após exame de sangue processado com sucesso, o Painel deve selecionar a nova análise e abrir a aba `Estado de Saúde` dentro do mesmo Painel.

## 11. Autenticação e sessão

O frontend deve consumir o Better Auth existente e tratar:

- sessão válida;
- sessão ausente;
- sessão expirada durante uso;
- erro de autenticação;
- criação de conta;
- logout.

Rotas clínicas devem continuar usando `credentials: include`. A aplicação não deve armazenar token clínico em localStorage.

## 12. Configurações

A tela de configurações deve manter:

- status da chave OpenRouter sem revelar a chave;
- modelo de extração;
- modelo de análise;
- lente interpretativa;
- prompts customizáveis das lentes.

Se a chave não estiver configurada, o banner deve orientar o administrador a definir `OPENROUTER_API_KEY`, sem mostrar segredo parcial ou conteúdo sensível.

## 13. Estados obrigatórios

Todos os módulos devem definir estados explícitos para:

- carregando;
- sucesso;
- vazio;
- erro recuperável;
- sessão expirada;
- indisponibilidade de API;
- dados parcialmente ausentes.

O estado carregando não deve deslocar violentamente o layout. O estado vazio deve explicar a próxima ação. O erro deve conter mensagem para o usuário e detalhe técnico apenas no log controlado.

## 14. Contratos de integração

O frontend React deve consumir os contratos existentes, sem acessar banco, filesystem ou variáveis secretas. As integrações atuais são:

| Recurso | Endpoint |
|---|---|
| Sessão Better Auth | `/api/auth/*` |
| Saúde do serviço | `GET /api/health` |
| Configurações | `GET/POST /api/settings` |
| Perfil | `GET/POST /api/profile` |
| Documentos | `GET /api/documents` |
| Arquivo PDF | `GET /api/documents/:id/file` |
| Análises | `GET /api/analyses` |
| Análise individual | `GET /api/analyses/:id` |
| Histórico estruturado | `GET /api/biomarkers/history` |
| Anotações | `POST /api/analyses/:id/annotations` |
| Upload | `POST /api/upload-document` |
| Catálogo de exercícios | `GET /api/exercises` |

As respostas devem ser normalizadas em uma camada de cliente HTTP tipada. Componentes não devem chamar `fetch` diretamente.

## 15. Organização funcional sugerida

```text
frontend/
  src/
    app/
      App.tsx
      routes.tsx
      providers/
    components/
      AppShell/
      Navigation/
      AnalysisContextBar/
      AnalysisDetailTabs/
      StatusCard/
      Labs/
      Scores/
      Profile/
      History/
      Upload/
      Settings/
    features/
      auth/
      analysis/
      biomarkers/
      documents/
      profile/
    lib/
      api-client.ts
      formatters.ts
      markdown.ts
    types/
      api.ts
      domain.ts
```

A estrutura é uma referência funcional. A divisão final pode variar, desde que estado, integração e apresentação permaneçam separados.

## 16. Requisitos não funcionais

- TypeScript em modo estrito.
- Vite para desenvolvimento e build do frontend.
- React sem dependência de manipulação manual de DOM.
- Componentes com foco visível e navegação por teclado.
- Contraste compatível com WCAG AA.
- Respeito a `prefers-reduced-motion`.
- Nenhum segredo no bundle do frontend.
- Build de produção servido pelo Express ou por um servidor estático protegido, mantendo a API no mesmo domínio lógico.
- Proxy de desenvolvimento para `/api`, sem alterar os endpoints.
- Testes para cliente HTTP, reducers/hooks de estado, seleção de análise e estados vazios/erro.

## 17. Critérios de aceite

### Navegação principal

- [ ] Usuário autenticado chega ao Painel.
- [ ] As cinco áreas principais podem ser acessadas sem reload completo.
- [ ] A área ativa é anunciada visualmente e semanticamente.

### Análise detalhada

- [ ] Não existe o link `Ver análise detalhada →` no card de Estado de Saúde.
- [ ] O menu de análise fica acima do card de Estado de Saúde.
- [ ] A aba Estado de Saúde é selecionada por padrão.
- [ ] As cinco abas funcionam dentro do Painel.
- [ ] Trocar aba não muda a análise ativa nem a URL.
- [ ] Trocar análise atualiza o conteúdo detalhado.

### Labs

- [ ] Painéis são selecionados por selects compactos.
- [ ] O gráfico e a explicação acompanham a seleção.
- [ ] A experiência funciona em viewport de 412 px sem rolagem vertical excessiva causada pelos controles.
- [ ] Ausência de dados e erro de carregamento são estados distintos.

### Compatibilidade

- [ ] Upload de sangue continua gerando análise e planos.
- [ ] Upload de bioimpedância continua atualizando perfil.
- [ ] Anotações continuam persistindo.
- [ ] PDFs continuam protegidos pela API existente.

### Qualidade

- [ ] `npm run check` continua passando.
- [ ] O build Vite é reproduzível.
- [ ] Smoke test cobre login, Painel, troca de análise, tabs detalhados, Labs, upload e logout.

## 18. Estratégia de entrega

### Fase 1: fundação

- adicionar workspace/frontend Vite;
- configurar TypeScript estrito;
- criar cliente HTTP tipado;
- configurar proxy `/api`;
- manter frontend antigo funcionando como fallback.

### Fase 2: shell e Painel

- migrar autenticação e shell;
- migrar contexto da análise ativa;
- implementar menu de análise detalhada no Painel;
- migrar Estado de Saúde, Insights e planos.

### Fase 3: módulos secundários

- migrar Labs;
- migrar Sistemas;
- migrar Perfil;
- migrar Histórico;
- migrar Configurações e Upload.

### Fase 4: troca de runtime

- executar smoke test comparativo;
- configurar Express para servir o `dist` do Vite;
- remover o frontend legado somente após os critérios de aceite;
- atualizar Dockerfile, Compose e documentação de execução.

## 19. Fora de escopo

- reescrita do backend Express;
- troca de PostgreSQL ou dos adapters de persistência;
- alteração dos prompts clínicos;
- alteração dos cálculos determinísticos;
- publicação externa da aplicação;
- introdução de uma nova plataforma de autenticação;
- criação de diagnóstico, prescrição ou interpretação clínica adicional.
