# Demonstração de envio para a análise da Meta

A instrução fornecida pela Meta pede incorporar ao site o envio da Configuração da API e gravar a mensagem saindo do aplicativo e chegando ao WhatsApp. A tela de demonstração do CRM executa o endpoint oficial `POST /PHONE_NUMBER_ID/messages` com o modelo `hello_world`, conforme a coleção oficial: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=request-13382743-bfd53137-07a0-4f88-a0bc-a15615a6dee2.

## Configuração manual

Disponível apenas ao usuário proprietário da conta com perfil admin ativo e permissão CRM. Adicionar na Vercel, Production:

- `WHATSAPP_REVIEW_WABA_ID`: identificação da conta de mensagens do número de teste.
- `WHATSAPP_REVIEW_PHONE_NUMBER_ID`: identificação do número de teste gerado pela Meta.
- `WHATSAPP_REVIEW_RECIPIENT`: um único destinatário previamente confirmado na Configuração da API, somente dígitos incluindo DDI e DDD.

Sem as três variáveis válidas, a ferramenta permanece desativada. A Meta precisa devolver o remetente como `Test Number` e telefone começando em `+1 555`; números de SDR em produção são rejeitados. Não há campos no navegador para escolher outro destinatário, texto, modelo, conta ou remetente. Só a mensagem de exemplo `hello_world` em `en_US` é permitida.

Não colocar token temporário nessas variáveis. Ele é informado em campo mascarado, mantido apenas em memória do formulário, encaminhado ao servidor/Meta para a operação e não persistido em tabelas. O campo é limpo ao fechar a seção ou concluir um envio. Nenhum token é retornado pela API. Não mostrar tokens na gravação.

O servidor valida sessão, origem, proprietário, aplicativo emissor, permissões do token e acesso efetivo ao WABA/número antes de consultar ou enviar. Não há envio automático, cron ou lote. O recebimento no WhatsApp precisa ser confirmado pelo próprio operador; um ID retornado pela API comprova aceitação, não entrega.

## Gravação manual

1. Concluir o cadastro do destinatário de teste na Meta e gerar seu token temporário, antes de iniciar a gravação.
2. Entrar na Genesy como proprietário e abrir CRM → Inteligência de Conversas → Demonstração para análise da Meta · Administrador.
3. Informar o token no campo mascarado. Nunca abrir o código curl com o token visível durante a gravação.
4. Iniciar uma gravação contínua de tela, mostrando o domínio da Genesy e a ferramenta.
5. Clicar em Consultar conta de teste para demonstrar o acesso real autorizado. Conferir o remetente retornado.
6. Clicar em Enviar hello_world ao meu WhatsApp de teste. O clique faz uma chamada real à Meta, exclusivamente para o destino configurado no servidor.
7. Mostrar a confirmação de aceitação e, em seguida, a conversa de teste no WhatsApp com a mesma mensagem recebida. Evitar expor outras conversas.
8. Anexar o arquivo à solicitação whatsapp_business_messaging.

A ferramenta ainda requer teste manual com token real e confirmação de entrega pelo usuário. A implementação não executou envio durante desenvolvimento ou publicação.

## Limites da demonstração

Demonstra somente consulta de conta de teste e envio oficial da mensagem de exemplo. Não conecta um SDR, não importa histórico, não prova Coexistence e não substitui a aprovação da Meta. A solicitação de revisão deve descrever com fidelidade o que o vídeo mostra. Se o formulário exigir também o fluxo OAuth ou, na permissão de gerenciamento, criação de modelo, essas demonstrações adicionais precisam ser concluídas e registradas separadamente. A consulta de conta não deve ser apresentada como criação de modelo.

Remover as três variáveis e fazer redeploy desativa a ferramenta depois da análise, quando ela não for mais necessária. Não exige migration.
