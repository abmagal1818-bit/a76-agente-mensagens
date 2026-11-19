# a76-agente-mensagens

Agente de WhatsApp com IA da A76 Motors, adaptado a partir do `agente-mensagens1` (Premium Automarcas) como ponto de partida. Codinome de trabalho — o nome final da IA ainda sera definido.

## Status

Em desenvolvimento, em paralelo ao site da A76 Motors. Ainda NAO esta em producao: nao ha credenciais reais de WhatsApp Business configuradas.

## Placeholders pendentes (preencher antes de ir ao ar)

- `NOME_IA` — nome da assistente de IA (hoje "A DEFINIR" no codigo)
- `TELEFONE_CONSULTOR` / `NUMERO_AUGUSTO` — telefone do consultor humano da A76 para escalonamento
- `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID` — credenciais do WhatsApp Business da A76 (conta ainda nao criada)
- `INSTAGRAM_TOKEN`, `INSTAGRAM_ACCOUNT_ID` — credenciais do Instagram da A76 (se for usar o recurso de stories)
- `BASE_URL` — URL publica do servico quando for implantado no Render

Ja preenchidos: `NOME_EMPRESA` = "A76 Motors", `SITE_EMPRESA` = "a76motors.com.br".

## Banco de dados

Usa o mesmo projeto Supabase da Premium Automarcas, porem isolado no schema `a76` (variavel `SUPABASE_SCHEMA`). Tabelas: `veiculos`, `clientes`, `mensagens`, `followups`, `coleta_credito_pendente`, `fotos_consultor_log`, `alertas_pendentes`.
