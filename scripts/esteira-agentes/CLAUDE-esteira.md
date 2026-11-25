
<!-- esteira:inicio -->
## Esteira (plataforma Genesy)
A plataforma mostra ao Lancaster, ao vivo, cada trabalho seu, numa esteira: **pedido → produzindo → esperando → aprovado → no_ar** (ou `concluido` / `cancelado`). Você avisa com `bash ../ferramentas/esteira.sh` (o script já sabe o endereço e o segredo; nunca leia nem mostre `../esteira.env`). Seu nome na esteira: `"agente":"__AGENTE__"`.

Quando avisar (só nos marcos, não a cada ação):
1. **Pedido de trabalho chegou** (criativo, campanha, ajuste de campanha, post, carrossel, stories, roteiro): crie o item com uma `ref` curta e única, que você reusa até o fim. Ex.: `bash ../ferramentas/esteira.sh item '{"agente":"__AGENTE__","ref":"luna-criativos-2511","titulo":"3 criativos de lançamento","cliente":"Luna","etapa":"pedido"}'`
2. **Começou a produzir**: `"etapa":"produzindo"`; nos marcos, `"passo":"Gerando a variação 2 de 3 no Canva","progresso":66`.
3. **Mandou prévia ou proposta para o Lancaster aprovar**: `"etapa":"esperando"`, com `"detalhe"` de uma linha (ex.: orçamento, nº de slides) e, se tiver, `"links":[{"label":"Prévia","url":"https://..."}]` (só https).
4. **Aprovado** (no Telegram ou pela plataforma): `"etapa":"aprovado"`. **Publicou / subiu / ativou**: `"etapa":"no_ar"`. Ajuste pedido: volte para `"produzindo"`. Desistiu: `"cancelado"`. Trabalho sem "no ar" (ex.: análise entregue): `"concluido"`.
5. **Rotinas** (relatório, ideias do dia) e avisos soltos: só uma linha no feed: `bash ../ferramentas/esteira.sh evento '{"agente":"__AGENTE__","texto":"Relatório diário de tráfego enviado"}'`.
6. **Aprendizado**: depois do "salva", além de gravar no arquivo, registre `bash ../ferramentas/esteira.sh aprendizado '{"agente":"__AGENTE__","tipo":"regra","escopo":"Luna · identidade","texto":"Fundo claro, sem gradiente"}'`. Proposta vinda dos números: `"tipo":"proposta"` com uma `ref`.

Mensagens que começam com **"[Esteira]"** chegam aqui no terminal: são decisões que o Lancaster tomou **na plataforma** (Aprovar, Ajustar, aceitar ou descartar proposta) e valem exatamente como a resposta dele no Telegram. Confirme no Telegram em uma linha (ex.: "✅ Aprovado pela plataforma: carrossel CRM, sigo com a publicação") e siga o fluxo normal. A aprovação pela plataforma não dispensa as outras travas (o botão Allow do Telegram continua valendo onde já valia).

Se o script responder "indisponível" ou "esteira desligada", siga o trabalho normalmente: a esteira nunca pode travar uma entrega. Se responder "dados recusados", corrija o JSON uma vez.
<!-- esteira:fim -->
