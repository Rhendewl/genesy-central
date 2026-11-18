# Contratos e assinaturas de clientes

Acesso interno: `/clientes?tab=contratos`.

## Ativação

1. Aplicar `supabase/migrations/20261105200000_client_contract_signatures.sql` no banco Supabase do ambiente, com uma conexão administrativa de migrações.
2. Publicar o aplicativo. A configuração existente `SUPABASE_SERVICE_ROLE_KEY` deve estar disponível somente no servidor.
3. Conferir um fluxo completo com cliente de teste antes de usar dados reais. O teste real cria um cliente ativo após o último aceite.

A migração foi testada em PostgreSQL local (PGlite); não foi aplicada ao banco de produção nesta implementação.

## Uso

- **Meus dados:** nome/razão social, CPF/CNPJ e endereço opcional da contratada.
- **Modelos:** importar `.docx` ou `.txt` de até 2 MB ou colar texto. A importação é textual e não replica o layout original do Word. Editar atualiza o modelo para as próximas emissões; os contratos já emitidos preservam o texto original.
- Marcar trechos usando os botões de campos ou inserir `{{nome_do_campo}}`. Campos aceitam letras sem acento, números e sublinhados.
- **Gerar contrato:** escolher modelo, preencher cliente e campos, conferir a prévia e listar todos os assinadores. Cliente, sócios, testemunhas e contratada podem assinar. Todos os integrantes da lista são obrigatórios.
- Copiar cada link individual e compartilhar manualmente com a pessoa correspondente. O sistema não envia mensagens automaticamente.
- Os links têm validade de 30 dias. Cancelar um documento pendente invalida todos os links. Para corrigir o texto ou trocar assinadores, cancelar e gerar outro.
- O contrato pendente representa um prospect e aparece na aba Contratos como **Assinatura Pendente**. Não entra na carteira financeira nem nas métricas de clientes ativos antes da conclusão.
- Após a última assinatura, uma transação registra a conclusão e cadastra o cliente ativo na tabela existente `agency_clients`. A mensalidade informada alimenta o cadastro, sem criar cobrança ou receita automaticamente.
- **Atualizar assinaturas** recarrega os estados. É possível baixar o documento com o registro das assinaturas em PDF; a página pública também permite imprimir/salvar em PDF.

## Registro e acesso

É um aceite eletrônico por link privado, com nome digitado, CPF/CNPJ informado, consentimento explícito, horário do servidor, IP de acesso quando disponível e navegador. Não inclui verificação de titularidade por SMS/e-mail nem certificado digital.

O texto tem identificação SHA-256. Depois de emitido, título, texto, dados do cliente e hash são imutáveis. As assinaturas registram esse mesmo hash. O PDF inclui a identificação do texto; o hash é do texto original, não dos bytes do arquivo PDF.

Os tokens são derivados por HMAC no servidor e apenas suas impressões SHA-256 ficam no banco. Trocar a chave de serviço invalida os links já gerados. Não registrar tokens em ferramentas de analytics, nem compartilhar um link com outro assinador. As respostas públicas não têm cache e a página usa `noindex` e `no-referrer`.

Cada usuário acessa apenas seus modelos, seus dados e seus contratos. Visitantes não recebem acesso direto às tabelas nem podem chamar as funções de gravação. O endpoint público valida o link e executa a operação com o cliente de servidor.

## Verificações

- `npx vitest run src/lib/contracts/__tests__ src/components/clientes/__tests__/contracts-ui.test.ts`
- `node scripts/tests/client-contract-signatures-db.mjs`
- `npx tsc --noEmit`

A compilação completa foi validada localmente com a resposta de fonte de teste do Next, porque o download da fonte Google falhou neste ambiente. A configuração de fontes do projeto não foi alterada.

## Atualização de experiência e validação (06/11/2026)

- Aplicar também `20261106010000_contract_email_verification.sql` antes de publicar. A assinatura passa a exigir código enviado ao e-mail cadastrado no convite; configurar `RESEND_API_KEY` e `RESEND_FROM_EMAIL` com remetente autorizado.
- Código de uso único, validade de 10 minutos, até cinco tentativas, intervalo mínimo de um minuto entre envios. Desafios ficam em tabela sem acesso público. Falha de verificação impede o registro do aceite.
- A verificação comprova acesso ao e-mail do convite, não identidade civil ou titularidade do CPF/CNPJ. O consentimento registra essa verificação e o estilo escolhido.
- Formulário agrupado por finalidade. Qualificações `cliente_qualificacao` e `contratada_qualificacao` são montadas com os dados das partes; testemunhas podem informar seu nome/documento ao assinar.
- Campos `*_extenso` e `*_por_extenso` são derivados do campo numérico correspondente, inclusive no servidor. Moeda usa formatação brasileira. Só são solicitados campos presentes no modelo.
- Data inicial usa America/Fortaleza. Cidade, UF e foro são lembrados neste navegador após preenchimento; revisar para cada contrato.
- Três fontes manuscritas locais com licença OFL. O estilo é persistido no registro de consentimento e aplicado ao PDF gerado no momento do download. PDFs já baixados não mudam; baixar novamente para obter novas assinaturas.
- A página pública oferece atualização manual dos assinadores e PDF atualizado. Os documentos antigos sem estilo usam Allura. A prévia interna começa recolhida.

## Correções de preenchimento (06/11/2026)

- Extensos associam os nomes usados nos modelos: `comissao_percentual` → `comissao_por_extenso`, `vigencia_meses` → `vigencia_por_extenso`, `mensalidade_valor` → `mensalidade_por_extenso`. Data de assinatura por extenso é preenchida com a data atual de America/Fortaleza.
- João Pessoa/PB e foro em João Pessoa/Paraíba são os valores iniciais. O botão **Salvar local como padrão** guarda alterações neste navegador; a data continua dinâmica.
- A lista inicial contém contratada, cliente e duas testemunhas. Nome e documento das partes acompanham os campos de origem; testemunhas podem preencher seu documento ao assinar.
- E-mails são opcionais tanto no cadastro do cliente quanto nos assinadores. Convites com e-mail continuam exigindo código; sem e-mail, o aceite utiliza o link individual privado e registra explicitamente a ausência de verificação de e-mail. Não registra comprovação de e-mail quando ela não ocorreu.
- Esta correção não requer nova migração.

- Correção adicional: campos repetidos no texto são deduplicados antes de procurar o valor numérico que alimenta o extenso. O modelo salvo contém duas ocorrências de `vigencia_meses`; isso agora calcula um único extenso corretamente.
- Os campos de testemunha não aparecem mais em Detalhes do contrato. `testemunha_N_nome`, `testemunha_N_cpf`, `testemunha_N_documento` e `testemunha_N_email` são derivados da ordem das testemunhas em Quem assina, no preview e no servidor.

## Apresentação e acompanhamento das assinaturas

- A página pública mantém apenas a logomarca à esquerda, com a legenda de assinatura à direita.
- Documento e PDF compartilham cabeçalho corporativo, linhas de assinatura e selos com assinatura manuscrita, ID do documento, código identificador da assinatura e horário. O código é o ID do registro, nunca o token secreto do link.
- A lista simples de assinaturas no final dos modelos reconhecidos é reorganizada visualmente; o texto salvo e seu SHA-256 não são alterados. Se o trecho final for ambíguo, ele é preservado e os blocos estruturados são acrescentados.
- Lista interna, detalhes e página pública consultam o estado a cada quatro segundos enquanto a janela está visível; também atualizam ao recuperar foco. A atualização pública preserva nome/documento que estejam sendo digitados.
- UTMs e identificadores de rastreamento dos leads são separados apenas na apresentação: respostas continuam em Dados de Formulário/Agendamento e rastreamento fica na seção expansível final. Dados armazenados não são reescritos.

- Apresentação: tipos de assinador usam Cliente, Contratado, Sócio(a) e Testemunha; títulos dos campos personalizados recebem iniciais maiúsculas e acentos. A seção pública de assinadores fica após a área de aceite, recolhida inicialmente.
- Novas opções de fonte: Great Vibes (clássica), Caveat (natural) e Shadows Into Light (traço fino). Identificadores antigos 0/1/2 preservam Allura/GreatVibes/Italianno para não alterar a aparência das assinaturas existentes. Novos estilos 3 e 5 são gravados no mesmo registro de consentimento.


## Biblioteca de modelos e notificações CRM

A aba Modelos abre com a lista de modelos existentes, quantidade de campos, Visualizar modelo e Editar modelo. Novo modelo abre um editor separado. Salvar alterações atualiza somente o modelo selecionado do usuário autenticado, sem alterar documentos emitidos.

Notificações de entrada no CRM e notificações de automações apontam para `/crm?pipeline=ID&lead=ID`. O Kanban valida o destino entre as pipelines acessíveis ao usuário. A tela de login preserva esse destino local. Notificações antigas já entregues com o link genérico não são modificadas. Não é necessária migração.

## Testemunhas sem nome e avisos de assinatura

- Nome de testemunha vazio ou contendo apenas espaços é permitido na emissão. O convite fica identificado como Testemunha e a própria pessoa informa nome e CPF/CNPJ na página de assinatura. O formulário indica explicitamente que o nome é opcional.
- Cada assinatura confirmada grava uma notificação para o proprietário do contrato e tenta entregar push nos dispositivos inscritos: `Contrato Assinado por [Nome]`. O nome vem do registro de assinatura já confirmado no banco.
- Após o estado assinado e a existência do cliente cadastrado, grava também `Contrato de [Cliente] Validado! Novo cliente adicionado!`.
- Eventos têm identificadores por assinatura e por conclusão, deduplicados pelo índice existente de evento/destinatário. Falhas de persistência têm uma nova tentativa sem desfazer ou invalidar a assinatura. As notificações abrem os detalhes do contrato em Clientes.
- Não é necessária migração para esta atualização.


## Exclusão e tipo do cliente

Aplicar `20261106020000_contract_client_type_and_deletion.sql` antes de publicar esta atualização. A migração preserva o contrato ao excluir o cliente (`client_id` fica vazio), remove os registros de assinatura junto com um contrato excluído e usa o tipo salvo no contrato para cadastrar o cliente após a última assinatura. Não exclui registros durante sua aplicação.

A exclusão de contrato exige confirmação no aplicativo e valida propriedade no servidor. O cliente cadastrado é preservado. A exclusão de cliente agora confirma que o banco removeu a linha, exibe erros sem fechar a janela como se tivesse dado certo e sincroniza as listas e os indicadores montados imediatamente. Respostas antigas de carregamento são ignoradas para não recolocar itens removidos.

Tipo de Cliente na emissão: Imobiliária, Corretor, Construtora ou Outro. Modelos/contratos antigos sem tipo continuam usando Outro. Contratos já emitidos mantêm seus dados originais.

## Vários contratantes

Em Quem assina, Adicionar contratante cria uma nova linha com nome e CPF/CNPJ próprios e e-mail opcional. Apenas o primeiro contratante acompanha automaticamente os dados do cliente principal. Os demais preservam suas identidades ao editar o cliente principal. Cada pessoa tem link e assinatura próprios; o contrato só conclui após todas as pessoas da lista assinarem.

Campos opcionais de modelo: `{{contratante_1_nome}}`, `{{contratante_2_nome}}`, `{{contratante_2_documento}}` e `{{contratante_2_email}}`, repetindo o índice para outros contratantes. Também são aceitos os prefixos `cliente_N_` e os sufixos cpf/cnpj. Eles são preenchidos a partir dos assinadores, sem solicitar os mesmos dados em campos personalizados separados. A carteira continua recebendo um cadastro para o cliente principal do contrato.
