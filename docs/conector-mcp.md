# Conector MCP da plataforma Genesy

Um único servidor MCP, dentro do próprio app (`/api/mcp`), dá ao Alfred, ao Bruce e aos projetos do claude.ai as mesmas ferramentas sobre os mesmos dados.

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `listar_clientes` | Clientes da agência (id, nome, tipo, status). Filtro por nome e status. |
| `ver_cliente` | Contato, metas de tráfego, contas de anúncio e os 10 últimos criativos. |
| `salvar_criativo` | Baixa a imagem/vídeo de um link https (ex.: exportação do Canva), guarda no bucket `criativos` (pasta `biblioteca/`) e registra em `criativos_biblioteca`. Devolve URL pública permanente. |
| `listar_criativos` | Biblioteca por cliente e status. |
| `atualizar_criativo` | Status (rascunho, aprovado, em_campanha, arquivado), título, notas, id da campanha na Meta. |
| `criar_tarefa` | Tarefa no Workspace do dono (quadro padrão, coluna A fazer, atribuída ao dono). |
| `listar_tarefas` | Tarefas abertas (ou por status). |
| `esteira_registrar` | Item, evento ou aprendizado na Esteira das IAs (mesma lógica de `/api/esteira/agente/*`). |

## Acesso

- Variáveis no Coolify: `GENESY_MCP_SECRET` (≥ 32 caracteres) e, opcional, `GENESY_MCP_OWNER_ID` (se faltar, usa `ESTEIRA_OWNER_ID`). Sem elas, a rota responde 503.
- Alfred e Bruce: `POST https://dash.genesycompany.com/api/mcp` com `Authorization: Bearer <segredo>` (configurado com `claude mcp add -s user`, fora da pasta versionada).
- claude.ai (conector personalizado): `https://dash.genesycompany.com/api/mcp/<segredo>` — o campo de URL não aceita cabeçalho. Quem tiver essa URL tem o acesso; para revogar, troque o segredo no Coolify.

Transporte: Streamable HTTP sem sessão, só POST com respostas JSON (GET devolve 405, permitido pela especificação). Versões aceitas: 2025-06-18, 2025-03-26, 2024-11-05.

## Segurança

- Tudo roda com o service role, sempre filtrado por `user_id = dono`.
- `salvar_criativo` aceita só https público: recusa localhost, `.internal`/`.local`, IPs privados, nomes que resolvem para IP privado e redirecionamentos para eles; até 25 MB; PNG, JPG, WEBP, GIF, MP4, MOV.
- Erros internos não vazam detalhes para o modelo (ficam no log como `[mcp] <ferramenta>: …`).

## Banco

Migração `20261125150000_criativos_biblioteca.sql`: tabela `criativos_biblioteca`, leitura no painel via `esteira_pode_ver(user_id)` (dono ou admin), escrita só pelo service role. Depois de aplicar, reiniciar o PostgREST (`supabase_supabase_rest`).
