# Mídia dos exercícios

O checklist usa o campo `gif` do catálogo local como mídia principal do exercício. Como o GIF é carregado em uma tag `<img>`, ele reproduz automaticamente sem depender de player ou integração com o OpenGym.

- O clique na miniatura continua abrindo a visualização ampliada.
- O controle `Pausar` troca o GIF pela imagem estática do mesmo exercício.
- O controle `Reproduzir` restaura o GIF.
- Se o GIF falhar, a interface tenta a imagem JPG correspondente.
- Se nenhum dos dois assets carregar, o exercício permanece sem imagem.
- As URLs-base podem ser substituídas por `EXERCISE_IMAGE_BASE_URL` e `EXERCISE_GIF_BASE_URL`, permitindo hospedar os arquivos sob controle do MedV2 no futuro.

Não há consulta ao OpenGym em runtime e nenhum arquivo de mídia do OpenGym foi copiado para o repositório. A decisão evita aumentar o artefato com um pacote grande de imagens e GIFs enquanto os assets atuais continuam disponíveis; uma futura hospedagem própria deve preservar a associação pelo mesmo `exercise.id` e os nomes do catálogo.
