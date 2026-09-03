# Instruções de exercícios em pt-BR

`backend/data/exercise-instructions.pt-BR.json` é um snapshot local das instruções em português brasileiro para os exercícios do catálogo MedV2.

- Cobertura: 1.324 IDs do catálogo local.
- Cobertura de passos: 7.710 instruções.
- Chave de associação: `exercise.id`.
- O runtime não consulta serviços externos para traduzir instruções.
- O adaptador valida IDs, quantidade de passos e conteúdo não vazio antes de disponibilizar o catálogo.

## Proveniência

As instruções são mantidas localmente para que alterações em fontes externas não modifiquem silenciosamente a experiência do MedV2. Qualquer atualização deve preservar a cobertura integral e passar por `npm run check`.
