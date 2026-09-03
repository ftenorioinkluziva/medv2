-- O handoff externo foi removido do produto. A tabela legada não deve mais
-- armazenar grants nem permanecer disponível no banco da aplicação.
DROP TABLE IF EXISTS medv2_handoff_grant;
