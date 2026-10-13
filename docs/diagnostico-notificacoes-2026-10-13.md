# Diagnóstico de notificações e e-mails — 13/10/2026

## Evidências consultadas em produção

- `/api/version` retornava `{"version":""}`. Uma variável Git vazia era aceita antes dos demais identificadores. A comparação descartava a versão e o aviso nunca aparecia.
- Respostas de análise comercial de 13/10 geraram notificações no banco. Um administrador tinha quatro inscrições push e resultados `accepted`; outro administrador não tinha inscrição e apresentava `no_subscription`.
- A permissão do navegador era suficiente para a interface declarar push ativo, mesmo sem confirmar o cadastro do dispositivo no servidor.
- O cadastro push podia falhar antes do login e não era refeito na navegação da autenticação para o dashboard. Falhas também permaneciam sujeitas ao intervalo de cinco minutos.
- A mesma resposta comercial é atualizada no banco por upsert. O identificador da notificação usava apenas o ID da resposta, suprimindo alertas de novas submissões dessa resposta.
- O agendador comercial executou em 12/10 e registrou quatro e-mails aceitos pelo Resend. Em 13/10, os dois clientes com automação ativa indicavam próximo envio em 19/10. Três configurações estavam com automação desativada. Essas escolhas foram preservadas.
- As colunas das migrações de programação comercial já existem no banco. O submódulo de compartilhamento carregou as pipelines após a migração da calculadora.
- As variáveis de push, cron e e-mail existem no projeto de produção da Vercel.

## Correções

- Identificador de publicação não vazio, preferindo a identidade do deployment. API e navegador usam o mesmo valor definido durante o build.
- Renovação de push após mudança de rota e nova tentativa sem o intervalo de bloqueio quando a tentativa anterior falhar.
- O sino só confirma push ativo após registrar a inscrição no servidor. Permissão concedida com falha oferece reconexão e mostra o erro.
- Eventos de análise incluem o instante da submissão, mantendo a deduplicação por evento sem suprimir uma nova resposta editada.
- Envio comercial compartilhado entre disparos manuais e automáticos: erros de rede/provedor são registrados por destinatário; só marca aceite quando recebe ID do provedor; envia versão em texto além de HTML; exige remetente configurado fora do sandbox.
- Tentativas iguais continuam idempotentes. Correções no endereço, remetente ou conteúdo geram uma chave diferente.
- Erros de consulta e gravação deixam de produzir resultados silenciosamente vazios em pontos do histórico e da automação.
- Histórico diferencia aceite pelo provedor de recebimento na caixa de entrada. O ID retornado pelo Resend é registrado nos logs, junto ao ID interno do envio.

## Migração de saldo pendente

A consulta final confirmou que `account_balance_alert_states` ainda não existe. O agendador e a consulta de saldo do portal preservam o armazenamento anterior enquanto isso. Para ativar alertas também de contas sem portal, executar separadamente `supabase/migrations/20260929080000_account_balance_alert_states.sql`. A calculadora não depende dessa migração.

## Limitações da verificação

A chave disponível do Resend permite somente enviar. As consultas de domínios e de entrega retornaram `restricted_api_key`, impedindo confirmar bounce, spam ou recebimento. Nenhum e-mail real foi disparado durante o diagnóstico. Para concluir essa investigação, conferir o painel Resend para os corretores e datas relatados.

A revisão automática bloqueou a exportação em massa das credenciais da Vercel por exposição desnecessária de segredos. O diagnóstico prosseguiu com os nomes das variáveis, metadados de publicação e registros do banco.

Navegadores ainda executando o código antigo com versão vazia precisam atualizar a página uma vez para carregar o detector corrigido. As publicações seguintes serão detectadas normalmente.
