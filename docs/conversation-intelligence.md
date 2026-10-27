# CRM — Inteligência de Conversas

Implementação de 27/10/2026, baseada no checkout `9b1cbfa`. Não usa WhatsApp Web, QR de sessão nem o worker histórico descrito no HANDOFF antigo. Nenhuma mensagem é enviada por este módulo.

## Fluxo entregue

1. SDR/admin/gestor comercial ativo, com permissão CRM, prepara conexão e abre Embedded Signup da Meta. A segunda ação preserva o gesto do usuário necessário para abrir o login.
2. Sessão de conexão expira em dez minutos e é consumida uma única vez, vinculada ao usuário e à conta. O servidor troca o código, verifica app/permissões, pertencimento do telefone ao WABA e os campos `is_on_biz_app` / `is_coex_enabled`. Qualquer erro ou elegibilidade não comprovada bloqueia o vínculo. Não existe alternativa de migração silenciosa que desative o aplicativo.
3. Após conexão, nenhum contato está autorizado por padrão. O SDR registra telefone, referência de consentimento, aceite da coleta e, separadamente, processamento externo por IA e compartilhamento da análise com gestores de um cliente.
4. O webhook aceita `messages` e `smb_message_echoes`, verifica HMAC-SHA256 sobre o corpo e limita o tamanho real a 1 MiB. WABA e telefone precisam corresponder à conexão. Eventos de histórico, agenda de contatos, status e conteúdo de mídias são descartados. Metadados de mensagens de mídia podem contar nas métricas; não há transcrição.
5. Persistência ocorre apenas com consentimento ativo, perfil ativo/permissão CRM, conexão ativa e timestamp posterior à autorização. Mensagens repetidas são idempotentes. Falha de persistência retorna 503 para permitir reenvio pela Meta. Não há fila que retenha payload bruto sem consentimento.
6. Revogar remove mensagens e análises. Pausar interrompe novas gravações. Desconectar elimina conexão, tokens, consentimentos, mensagens e análises por cascata. Reautorizar uma conversa expirada/revogada cria uma nova janela, sem recuperar o histórico anterior.
7. Análise Comercial apresenta indicadores das conversas vinculadas ao cliente e explicitamente compartilhadas. SDR vê apenas suas próprias contribuições; admin/gestor da mesma conta vê a consolidação autorizada. Mensagens e IDs de evidências não são enviados ao painel agregado. As métricas de conversas não são somadas às métricas de mídia/coletas para evitar dupla contagem.

## Segurança e privacidade

- RLS separa SDRs inclusive dentro da mesma conta. Tokens e sessões não têm leitura para usuários autenticados. Escritas de usuários são negadas nas tabelas; rotas autenticadas e funções restritas a `service_role` controlam as alterações.
- Conta é derivada de `effective_owner_id()` da sessão; não é aceita do navegador. Papéis, perfil ativo e permissão CRM são verificados no servidor e na ingestão. Mutações exigem origem do próprio site.
- Tokens e textos são criptografados com AES-256-GCM usando `TOKEN_ENCRYPTION_KEY`. Telefones de contatos viram HMAC com chave própria; a interface mantém apenas os últimos quatro dígitos. Referências de consentimento não devem conter dados sensíveis.
- Rotinas de gravação/revogação usam bloqueios no banco. Uma resposta tardia da IA não recria análise após revogação. Lease de um minuto evita chamadas concorrentes da mesma conversa.
- IA Anthropic é acionada manualmente e somente com autorização separada. Usa até 40 mensagens recentes, até 1.500 caracteres de cada texto, dos últimos 30 dias. Remove padrões de telefone/e-mail antes do envio; isso **não é anonimização completa**. Nomes e dados livres podem permanecer. A escolha do fornecedor, contrato, configuração de retenção e modelo precisa ser validada antes da ativação real.
- Interpretações de objeção, intenção e condutas de atendimento exigem IDs reais de mensagens; resposta inválida é rejeitada. O conteúdo é tratado como não confiável e o modelo não recebe ferramentas. A IA não calcula indicadores nem gera nota pessoal de desempenho. Seus achados continuam sujeitos a revisão humana.
- Conteúdo é retido por até 30 dias, com limpeza diária; pode haver até um intervalo do cron entre expiração e remoção física. Leituras do módulo filtram a janela. Autorizações valem 90 dias. Referências de autorizações expiradas/revogadas são removidas após 180 dias; auditoria também tem retenção de 180 dias. Backups e retenção no fornecedor são administrados fora deste código.
- Desconectar na Genesy interrompe a retenção local; não remove a inscrição inteira do WABA na Meta, pois ela pode servir outros SDRs. A autorização do aplicativo na Meta pode ser removida pelo titular no ambiente da Meta.

## Definições verificáveis

Períodos de 7, 14 ou 30 dias, em janela móvel de tempo absoluto. Interface mostra horário do navegador. Não há ajuste para expediente comercial.

- Conversas: contatos distintos por conexão com mensagens observadas no período. A mesma pessoa em dois SDRs conta duas vezes.
- Atendidos: contatos com saída observada.
- Taxa de resposta: contatos com entrada posterior à primeira saída observada / contatos com saída observada. Sem denominador, mostra ausência de dado.
- Primeira resposta: mediana do intervalo entre a primeira entrada observada e a próxima saída no período, com número de amostras. Não representa necessariamente a primeira resposta de toda a vida do lead.
- Follow-up: saída imediatamente precedida por outra saída observada, sem entrada entre elas, com pelo menos 24 horas de intervalo.
- Pendências de 48h: última mensagem observada, separando espera por SDR e espera por contato.

Consultas paginam mensagens para evitar o limite implícito do Supabase. Acima de 50.000 mensagens ou 1.000 autorizações, rejeitam o escopo em vez de devolver um total truncado. Não há promessa de cobertura integral: histórico, dispositivos não compatíveis, mídia e falhas de entrega podem faltar. Conteúdo de texto maior que 12.000 caracteres é limitado na ingestão.

## Configuração necessária antes de ativar

Aplicar `supabase/migrations/20261027_conversation_intelligence.sql` em homologação e depois produção pelo processo de migrations do projeto. Confirmar grants/RLS. Publicar o código somente depois de validar a configuração abaixo.

Variáveis exclusivamente no servidor:

- `META_APP_ID`, `META_APP_SECRET`: aplicativo aprovado da Meta.
- `WHATSAPP_SIGNUP_CONFIG_ID`: configuração de Facebook Login for Business / Embedded Signup habilitada para usuários do WhatsApp Business App (Coexistence).
- `WHATSAPP_GRAPH_VERSION`: versão atualmente suportada e validada no aplicativo. Não há versão presumida no servidor.
- `WHATSAPP_VERIFY_TOKEN`: segredo próprio para desafio do webhook.
- `WHATSAPP_CONTACT_HASH_KEY`: segredo estável de pelo menos 32 caracteres. Não reutilizar o app secret.
- `TOKEN_ENCRYPTION_KEY`: 64 caracteres hexadecimais, já usada pelo projeto. Planejar rotação e recuperação.
- `ANTHROPIC_API_KEY`, `WHATSAPP_ANALYSIS_MODEL`: chave e ID explícito de um modelo disponível/aprovado.
- `CRON_SECRET`: autoriza `/api/cron/conversation-retention` (Vercel envia Bearer). Cron incluído no `vercel.json`, diariamente às 03:30 UTC / 00:30 Fortaleza.
- Configuração Supabase já existente: URL, chave pública e service role.

No painel Meta:

- Validar verificação empresarial, condições de Tech Provider/Embedded Signup aplicáveis, App Review e acesso avançado necessário para conectar números de outros negócios.
- Solicitar/validar `whatsapp_business_management` e `whatsapp_business_messaging`; conferir outras permissões exigidas pela configuração escolhida, sem reutilizar automaticamente o fluxo de anúncios do projeto.
- Registrar domínios de produção/homologação e JavaScript SDK allowed domains. Confirmar versão do protocolo de Embedded Signup: o cliente implementa `sessionInfoVersion: "3"` e o evento `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`; isso exige confirmação no app atual antes da homologação.
- Endpoint HTTPS: `/api/crm/conversation-intelligence/webhook`. Validar challenge, inscrever campos `messages` e `smb_message_echoes`, e autorizar inscrição do app no WABA. O fluxo registra `subscribed_apps` no servidor.
- Confirmar elegibilidade do número/país/conta e versão suportada do aplicativo Business. O número deve manter o atendimento no aplicativo após conectar. Se a API não expuser os campos de elegibilidade implementados, o vínculo falha fechado e o contrato deve ser ajustado após confirmação oficial.
- Conferir política de privacidade e processo de exclusão nos URLs públicos existentes. A análise requer autorização dos contatos e do SDR conforme os controles da interface.

Referências oficiais para revisão no processo de homologação:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started

**Limitação da pesquisa:** essas páginas retornaram HTTP 429 na consulta desta implementação. Requisitos vigentes e o contrato completo de Coexistence não foram certificados contra a documentação acessível. Os pontos acima são a lista de verificação da integração implementada, não uma declaração de aprovação concedida pela Meta.

## Validação e deploy

- Vitest: suíte completa passou (1.221 testes / 135 arquivos, incluindo 16 testes novos).
- TypeScript sem emissão: passou.
- Build de produção Next.js: passou, com valores fictícios de Supabase para compilação. Não demonstra conexão real com serviços externos.
- PostgreSQL isolado via PGlite: migration, permissões/RLS, isolamento entre SDRs e contas, gate de consentimento, duplicatas, revogação, análise tardia e remoção em cascata testados. Script: `scripts/tests/conversation-intelligence-db.mjs`; instalar `@electric-sql/pglite` em um diretório temporário e passar `PGLITE_MODULE=/caminho/absoluto/dist/index.js`.
- Não foram executados Embedded Signup real, entrega real de echoes, análise real por fornecedor nem teste visual com conta autenticada.
- Estado consultado em 27/10/2026: produção em `https://dash.genesycompany.com` respondeu 307 para `/auth`, servidor Vercel; `/api/version` retornou `dpl_GuEUghrEPAEpzurKjCwvMcHAku1z`.
- Supabase consultado em leitura: `commercial_intelligence_settings` respondeu 200; `ci_connections`, `ci_consents`, `ci_messages` responderam 404/PGRST205. Migration nova não aplicada no ambiente consultado.
- Nenhum push, deploy, inscrição Meta real ou alteração de produção foi realizado nesta implementação. O projeto faz deploy automático ao publicar `main`; não publicar sem fechar a homologação.

Homologação necessária: dois SDRs/números elegíveis, contato autorizado e outro não autorizado, entradas e saídas pelo aplicativo, replay/reordenação, revogação durante IA, perda de permissão CRM, token revogado, exclusão, cron e comparação manual das métricas. Aprovação Meta e configuração real permanecem pendentes.

## Entrega no repositório

A implementação está na branch `codex/conversation-intelligence`, em um worktree vinculado ao repositório Genesy original:

`/Users/lancastermatos/Documents/Codex/2026-10-27/referenced-chatgpt-conversation-this-is-an/work/genesy-conversation-intelligence`

O checkout original estava com um cherry-pick em andamento, apesar de não apresentar alterações rastreadas. Essa operação foi preservada; não houve abort, quit, reset nem troca de branch no checkout original. O patch fornecido reproduz a implementação e pode ser revisado antes de integrar à branch de produção.
