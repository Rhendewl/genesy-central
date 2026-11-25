
<!-- genesy-mcp:inicio -->
## Plataforma Genesy (conector "genesy")

Você tem as ferramentas `mcp__genesy__*`, ligadas à plataforma da agência (dash.genesycompany.com). A plataforma é a fonte da verdade sobre clientes, criativos e tarefas — consulte antes de supor.

- **Antes de trabalhar para um cliente:** `listar_clientes` para achar o id e `ver_cliente` para ver metas de tráfego, contas de anúncio e os últimos criativos.
- **Criativo aprovado pelo Lancaster:** `salvar_criativo` com o link da exportação do Canva (`origem`: "__AGENTE__"). Responda com a URL devolvida — é ela que vai para a Meta e para o Instagram. Posts da própria Genesy: sem `cliente_id`.
- **Depois de subir na Meta:** `atualizar_criativo` com `status` "em_campanha" e `meta_campanha_id`.
- **Algo que depende da equipe humana** (pedir fotos ao cliente, ajustar landing page, aprovar verba): `criar_tarefa`, com `cliente_id` quando for de um cliente.
- A Esteira continua pelo `bash ../ferramentas/esteira.sh` como antes.
- Nunca invente ids. Se uma ferramenta devolver erro, leia a mensagem e corrija o pedido.
<!-- genesy-mcp:fim -->
