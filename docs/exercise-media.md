# Mídia dos exercícios

O catálogo de exercícios e as mídias são persistidos no PostgreSQL do MedV2. A tabela `medv2_exercise` guarda os dados do exercício e `medv2_exercise_media` mantém a relação por exercício, tipo (`image` ou `animation`), nome original, MIME, hash, tamanho e conteúdo binário.

O importador lê o módulo JavaScript `EXDB`, valida os registros com Zod e associa os arquivos JPG/GIF pelos campos `img`/`gif`. Os diretórios de origem são usados apenas durante a importação; não são necessários em runtime.

- O checklist prioriza o GIF animado.
- O controle `Pausar` troca o GIF pela imagem estática do mesmo exercício.
- O controle `Reproduzir` restaura o GIF.
- Se o GIF falhar, a interface tenta a imagem JPG correspondente.
- Se nenhum asset existir ou carregar, o exercício permanece sem imagem.
- As mídias são entregues por `GET /api/exercises/:exerciseId/media/:kind`.

Exercícios personalizados podem ser cadastrados sem registros em `medv2_exercise_media` e, portanto, sem mídia por padrão.
