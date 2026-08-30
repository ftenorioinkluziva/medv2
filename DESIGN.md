---
name: MedV2
description: Painel operacional de saúde da suíte, derivado do sistema Paridade Risco com ação laranja.
register: product
sourceSystem: C:/projetos/paridade-risco-mobile/DESIGN.md
colorStrategy: restrained
colors:
  operational-graphite: "oklch(0.18 0.008 275)"
  panel-slate: "oklch(0.22 0.01 275)"
  raised-slate: "oklch(0.26 0.012 275)"
  inset-graphite: "oklch(0.195 0.008 275)"
  border-ash: "oklch(0.30 0.012 275)"
  text-clear: "oklch(0.97 0.005 75)"
  text-muted: "oklch(0.70 0.014 275)"
  text-soft: "oklch(0.52 0.014 275)"
  action-orange: "oklch(0.72 0.18 55)"
  action-orange-strong: "oklch(0.64 0.19 48)"
  command-ink: "oklch(0.17 0.008 275)"
  success-green: "oklch(0.72 0.17 145)"
  warning-amber: "oklch(0.78 0.16 78)"
  danger-red: "oklch(0.64 0.21 25)"
  info-blue: "oklch(0.72 0.12 245)"
typography:
  sans: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  mono: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"
rounded:
  field: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  xxxl: "32px"
layout:
  contentMaxWidth: "760px"
  touchMinimum: "40px"
  fieldHeight: "48px"
---

# Design System: MedV2

## Creative North Star

**Painel de Evidência**

O MedV2 compartilha a gramática visual do Paridade Risco: painel operacional escuro, superfícies planas, bordas estruturais, densidade controlada e informação precisa. A identidade do sistema muda por uma única voz de ação. No MedV2, essa voz é laranja.

A cena de uso é uma pessoa revisando seus exames em um monitor ou celular, geralmente em ambiente doméstico de luz moderada, tentando compreender informações sensíveis sem ansiedade visual. O tema grafite reduz brilho, mantém continuidade com a suíte e permite que alertas clínicos apareçam apenas quando têm função real.

## Regras compartilhadas da suíte

- Fundo grafite, painel slate, superfície elevada e inset seguem os mesmos papéis do Paridade Risco.
- Conteúdo usa largura máxima de 760px.
- Cards principais usam raio de 8px, padding de 16px, borda de 1px e nenhuma sombra decorativa.
- Campos usam raio de 4px, altura de 48px e superfície inset.
- Ações têm altura mínima de 40px e raio de 8px.
- Tipografia sans de sistema serve leitura; mono serve labels, IDs, datas, unidades, valores e comandos.
- Movimento dura 150 a 250ms e comunica apenas mudança de estado.

## Regra de identidade

**Orange Means Action.** Laranja marca ação primária, seleção ativa, foco e progresso escolhido pelo usuário. Não usar laranja para classificar gravidade ou decorar superfícies.

Cada aplicativo da suíte troca somente os tokens `action` e `action-strong`. Neutros, tipografia, espaçamento, raios, componentes e cores semânticas permanecem estáveis.

## Cor semântica

- Verde: normal, sucesso ou evolução positiva.
- Âmbar: atenção ou informação que requer revisão.
- Vermelho: risco, erro ou ação destrutiva.
- Azul: informação clínica neutra ou estado baixo quando explicitamente rotulado.

Nenhum estado depende apenas da cor. Usar label, texto, ícone ou estrutura junto do tom.

## Tipografia

- Display: 30px, peso 700, uma vez por tela quando houver título explícito.
- Headline: 20px, peso 600, valores ou estado principal.
- Title: 18px, peso 600, títulos de seção.
- Body: 14px, peso 500, linha de 20px.
- Label: mono, 11 a 12px, peso 600.
- Data: mono, 16 a 20px, peso 600 ou 700.

## Componentes

### Navegação

Barra plana com borda inferior. Item ativo usa texto laranja e fundo laranja de baixa intensidade. Itens inativos usam texto muted. O shell preserva navegação previsível no desktop e rolagem horizontal segura no celular.

### Cards e containers

Usar cards somente para agrupar uma decisão, um conjunto de dados ou uma tarefa. Itens internos usam superfície inset, não outro card elevado. Hover altera borda e fundo, sem deslocamento vertical.

### Botões

- Primary: fundo laranja, texto command ink e borda laranja forte.
- Neutral: superfície elevada, texto claro e borda ash.
- Danger: vermelho apenas para efeito destrutivo.
- Focus: outline laranja de 2px com offset.
- Disabled: opacidade 0.5, cursor bloqueado e texto legível.

### Inputs

Fundo inset, borda ash, raio de 4px e altura de 48px. Labels mono e soft. Focus usa borda e halo laranja discreto. Erro usa texto explícito, não apenas borda.

### Alertas

Fundo inset e borda completa na cor semântica. Não usar faixa lateral, gradiente ou glassmorphism. Título e label textual identificam severidade.

### Dados clínicos

Biomarcadores, unidades, datas, scores e ranges usam mono quando a leitura ganha precisão. Texto explicativo permanece sans e limitado a 75 caracteres por linha quando possível.

## Proibições

- Gradientes decorativos.
- Texto em gradiente.
- Glassmorphism.
- Sombras pesadas como linguagem de elevação.
- Bordas laterais coloridas em alertas.
- Botões circulares quando um controle contido de 8px comunica melhor.
- Laranja em estados de perigo, alerta ou normalidade.
- Grids de cards idênticos sem hierarquia de decisão.
