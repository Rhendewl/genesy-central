# Inteligência de concorrentes — Marketing

Implementado em `/marketing/concorrentes`, dentro do layout, controle de acesso e navegação existentes (Next.js 14, React, Supabase, Tailwind). Não modifica a integração de relatórios/Instagram Login.

## Ativação

1. Aplicar `supabase/migrations/20261029220000_instagram_competitors.sql` no ambiente escolhido usando o processo de migrações do projeto. Migração testada em PostgreSQL local via PGlite e aplicada no Supabase de produção.
2. Configurar somente no servidor (nunca `NEXT_PUBLIC_`):
   - `META_DISCOVERY_ORGANIZATION_ID`: UUID do proprietário/organização autorizado a usar a conexão.
   - `META_DISCOVERY_IG_USER_ID`: ID numérico da conta profissional chamadora, vinculada a uma Página Facebook.
   - `META_DISCOVERY_ACCESS_TOKEN`: token Facebook User obtido por Facebook Login com acesso à conta e permissões apropriadas. Não reutilizar o token Instagram Login de relatórios.
   - `META_DISCOVERY_GRAPH_VERSION`: versão Graph suportada pelo app, formato `vNN.0`; sem fallback silencioso. Validar a versão no painel Meta e fazer uma coleta de homologação.
   - `CRON_SECRET` e credenciais Supabase já usados pelo projeto.
3. No app Meta, revisar `instagram_basic`, `instagram_manage_insights` e `pages_read_engagement`; `pages_show_list` para seleção da Página e, conforme a atribuição via Business Manager, requisitos adicionais. Revisão/Advanced Access e modo Live dependem do público que usará o app. Grants reais confirmados em 30/10/2026: instagram_basic e instagram_manage_insights concedidos, além das permissões de Páginas. Conta chamadora @lancastermatos, Graph v25.0. Token estendido com expiração aproximada em 29/12/2026; renovar antes dessa data e republicar a aplicação.
4. Fazer deploy pelo fluxo habitual. Aplicar também `20261029221000_instagram_competitors_cron.sql`: o Supabase chama `/api/cron/instagram-competitors` no minuto 30 de cada hora, até dois perfis por chamada. Reutiliza o segredo de agendamento Instagram no Vault e seu hash `INSTAGRAM_SCHEDULER_SECRET_SHA256` já configurado na Vercel. Compatível com o plano Hobby; não adiciona cron horário à Vercel. Sem credenciais Meta, o worker responde que a coleta foi pulada e não consulta perfis.
5. Cadastrar perfil profissional público e usar **Comparação e perfis → Coletar agora**. Testar conta permitida, conta pessoal/privada, token revogado e limite da Meta em homologação. Rotacionar token no servidor quando necessário.


## Dados e limites

- Somente `graph.facebook.com`, endpoint Business Discovery oficial. Sem scraping, dados privados ou coleta de insights de terceiros.
- Uma chamada por perfil a cada 24 horas, inclusive após falhas. Máximo de 20 perfis por organização. Limites são controles internos conservadores, não promessa de quota Meta. Erro de rate limit adia toda a organização por 24 horas; falhas não provocam loop de retentativas.
- Até 50 publicações recentes por coleta. Não percorre paginação nem garante importação de todo o histórico; a UI identifica cobertura parcial. As publicações observadas ficam acumuladas, mas posts fora da janela recente deixam de receber atualização de métricas. Data de coleta aparece por post.
- `like_count` e `comments_count` ausentes são `null`, nunca zero. Views, alcance, saves, shares, audiência e conversões não são solicitados, inferidos nem exibidos como fatos.
- IPR = (curtidas + comentários) / média dos posts completos do mesmo perfil e `media_type` no período escolhido, incluindo o próprio post. Pelo menos cinco amostras e média positiva. Vídeos são agrupados como VIDEO; não presume que todo vídeo é Reel. Comparações têm viés por idade, amostragem e possível impulsionamento não observável.
- Ranking lê até 1.000 posts mais recentes no período de 30/60/90 dias e avisa sobre truncamento. Comparação geral mostra seguidores, posts e média com tamanho da amostra.
- Coleta grava estado atual e snapshot em uma única transação. Histórico exibe últimas 30 observações; todas são preservadas no banco até exclusão do perfil. Exclusão remove publicações, snapshots por cascade. Nenhum processo de retenção automática foi habilitado.

## Segurança e manutenção

Leitura via sessão Supabase + RLS (proprietário, administrador ou membro ativo com Marketing). Escritas e RPC de observação restritas a service role; cada rota valida sessão, papel e organização antes de operar. Chave Meta nunca vai ao cliente, a URLs, logs ou mensagens de erro. IDs/nomes validados; links limitados a HTTPS Instagram. Claim de sincronização é atômico. Mudança de ID de uma conta para o mesmo @ bloqueia mistura de históricos.

## Verificação

- TypeScript completo sem erros.
- Testes Vitest de ranking, validação, respostas Meta, isolamento de credenciais, autorização das rotas e estados da interface.
- Teste de banco: migração, snapshots imutáveis, upsert, rollback, isolamento entre organizações, RLS para proprietário/membro/usuário sem acesso, restrição de escrita, limite de perfis e exclusão em cascata.

## Referências oficiais

- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

A documentação direta Meta respondeu HTTP 429 durante a consulta. A coleção oficial Meta no Postman confirmou o escopo geral Facebook Login/Página/contas profissionais; permissões e versão foram validadas por chamadas reais à API Meta em 30/10/2026.

## Escopo atualizado

A análise com IA foi removida por solicitação do usuário: sem aba, endpoint de processamento, chamadas a provedores, chave ou cobrança de IA. A migração inicial já aplicada contém uma tabela de análises sem uso; ela não é consultada nem preenchida pela aplicação. Mantida para não reescrever o histórico da migração aplicada.

A conexão Business Discovery é provisionada no servidor para uma organização. Não há OAuth novo nesta entrega. As quatro variáveis META_DISCOVERY_* foram configuradas como segredos de produção na Vercel após validação do token e das permissões. O agendamento Supabase instagram-competitors-tick está ativo no minuto 30 de cada hora. O token não é renovado automaticamente: gerar novo token autorizado antes do vencimento, atualizar META_DISCOVERY_ACCESS_TOKEN e fazer novo deploy.
