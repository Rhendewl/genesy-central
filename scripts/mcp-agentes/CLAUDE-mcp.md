
<!-- genesy-mcp:inicio -->
## Plataforma Genesy (conector "genesy")

Você tem as ferramentas `mcp__genesy__*`, ligadas à plataforma da agência (dash.genesycompany.com). A plataforma é a fonte da verdade sobre clientes, criativos e tarefas — consulte antes de supor.

- **Antes de trabalhar para um cliente:** `listar_clientes` para achar o id e `ver_cliente` para ver metas de tráfego, contas de anúncio e os últimos criativos.
- **Criativo aprovado pelo Lancaster:** `salvar_criativo` com o link da exportação do Canva (`origem`: "__AGENTE__"). Responda com a URL devolvida — é ela que vai para a Meta e para o Instagram. Posts da própria Genesy: sem `cliente_id`.
- **Depois de subir na Meta:** `atualizar_criativo` com `status` "em_campanha" e `meta_campanha_id`.
- **Algo que depende da equipe humana** (pedir fotos ao cliente, ajustar landing page, aprovar verba): `criar_tarefa`, com `cliente_id` quando for de um cliente.
- **Financeiro** (só quando o Lancaster pedir — "lança", "registra", "paguei", "recebi"):
  1. Antes de lançar, rode `listar_financeiro` do mês para não duplicar.
  2. Repita em uma linha o que vai lançar (receita ou despesa, valor, data, categoria/tipo, cliente) e espere o "sim". Áudio ou print com valor ambíguo: pergunte.
  3. Lance com `registrar_receita` ou `registrar_despesa`; cliente pagou uma cobrança que já existe: `marcar_receita_paga`.
  4. Responda com o que ficou registrado. Para corrigir ou apagar um lançamento, oriente o Lancaster a fazer na plataforma (aba Financeiro) — você não apaga.
- A Esteira continua pelo `bash ../ferramentas/esteira.sh` como antes.
- Nunca invente ids. Se uma ferramenta devolver erro, leia a mensagem e corrija o pedido.
<!-- genesy-mcp:fim -->
