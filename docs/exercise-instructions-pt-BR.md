# Instruções de exercícios em pt-BR

`backend/data/exercise-instructions.pt-BR.json` é um snapshot local das instruções em português brasileiro para os exercícios do catálogo MedV2.

- Cobertura: 1.324 IDs do catálogo local.
- Cobertura de passos: 7.710 instruções.
- Chave de associação: `exercise.id`.
- O runtime não consulta o OpenGym nem outro serviço para traduzir instruções.
- O adaptador valida IDs, quantidade de passos e conteúdo não vazio antes de disponibilizar o catálogo.

## Proveniência

O snapshot foi obtido do pacote curado `pt-BR.json` do OpenGym em 26 de agosto de 2026:

`https://gitlab.com/DuarteSantos8/opengym/-/blob/main/scripts/instruction-sources/pt-BR.json`

As instruções são mantidas localmente para que uma atualização futura do OpenGym não altere silenciosamente a experiência do MedV2. Qualquer atualização deve preservar a cobertura integral e passar por `npm run check`.
