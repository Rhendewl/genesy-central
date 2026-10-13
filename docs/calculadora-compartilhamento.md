# Calculadora pública e captura de leads

## Ativação no Supabase

1. Abra o SQL Editor do mesmo projeto Supabase usado pelo aplicativo.
2. Execute **somente** `supabase/migrations/20261013090000_calculator_capture.sql`, uma vez.
3. A migração tem transação própria: as tabelas e funções são criadas juntas. Não exige executar outras migrações pendentes do repositório.
4. Atualize `/calculadora/compartilhamento`, escolha uma pipeline ativa e uma etapa de entrada e crie o link.
5. Copie o endereço público gerado. No ambiente local, o link usa localhost; online, usa o domínio público configurado em `NEXT_PUBLIC_PUBLIC_SITE_URL` (padrão `https://go.genesycompany.com`). A versão online também precisa receber os novos arquivos do aplicativo.

## Funcionamento

- A calculadora interna permanece em `/calculadora`.
- Os submódulos são `/calculadora/compartilhamento` e `/calculadora/leads`.
- Cada link público fica em `/simular/<identificador>` e não carrega o dock, providers autenticados ou telas internas.
- Nome, e-mail, contato com DDD e perfil são obrigatórios. CRECI é opcional.
- O cadastro grava o lead no CRM e a captura na mesma transação. A etapa e a pipeline vêm da configuração do link, nunca do visitante.
- O mesmo contato no mesmo link não duplica cadastros. Um lead existente com o mesmo contato na mesma pipeline é reaproveitado sem ser movido de etapa.
- Um cookie HttpOnly assinado, válido por um ano, lembra o navegador. Apagar cookies exige novo acesso. Não há coleta de impressão digital do dispositivo.
- “Já me cadastrei” consulta se o contato existe nesse link e libera somente a calculadora. Não comprova a posse da linha por SMS e não devolve dados pessoais ou de CRM.
- Links podem ser pausados. Pipeline ou etapa arquivada também interrompe o acesso público.
- Colaboradores só gerenciam capturas de sua pipeline atribuída. Proprietários e administradores podem escolher entre as pipelines do workspace.

## PDF das Notas

O botão PDF fica no cabeçalho da nota. Exporta o conteúdo atual do editor, inclusive alterações ainda não salvas, em páginas verticais de 108 × 192 mm. Mantém títulos, listas, negritos, links, tabelas, imagens e anexos. Divisórias iniciam novas páginas; texto longo continua automaticamente. Divisórias consecutivas e finais não criam páginas vazias extras.

## Verificações realizadas

- Testes de assinatura, expiração e isolamento do acesso público.
- Testes das rotas de cadastro, recuperação por contato e limite de tentativas.
- Testes de permissão por workspace e pipeline.
- Execução da migração em PostgreSQL temporário: captura atômica, deduplicação, destino configurado, bloqueio anônimo, links pausados e etapas arquivadas.
- Renderização e inspeção visual do PDF mobile de exemplo.
