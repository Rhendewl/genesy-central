# Etiquetas próprias de cada pipeline

## Implementação

O CRM usa `crm_pipeline_tags`, com chave composta `(pipeline_id,id)`, em vez de compartilhar o catálogo `tags` com outros módulos. Cada catálogo tem nomes e cores independentes. Consultas, criação, alteração, exclusão, cache do navegador, cards e seletores de automações são filtrados pela pipeline. As permissões respeitam proprietário e acesso à pipeline.

A migração copia somente etiquetas globais já utilizadas em leads ou gatilhos de automações daquela pipeline. IDs antigos permanecem iguais, preservando atribuições e configurações de automações. Se uma etiqueta era usada em duas pipelines, cada uma recebe sua cópia independente. Nenhuma etiqueta global é apagada ou alterada. Etiquetas globais sem uso identificável em pipelines não são importadas indiscriminadamente.

Uma regra no banco impede novas atribuições de etiquetas de outra pipeline, incluindo operações que copiam leads entre pipelines. Ela não altera os leads existentes durante a migração. Ao copiar um lead futuramente, somente etiquetas presentes no catálogo da pipeline de destino são mantidas. A rota de atualização de etiquetas também valida o catálogo antes de publicar eventos de automação.

## Ativação pendente de aprovação

1. Aplicar somente `supabase/migrations/20261029190000_crm_pipeline_tags.sql` no banco existente, em transação.
2. Definir NEXT_PUBLIC_CRM_PIPELINE_TAGS_ENABLED=true na Vercel e publicar imediatamente a versão correspondente. O recurso permanece inativo sem essa configuração para permitir outras publicações enquanto a migração aguarda aprovação.
3. Atualizar os navegadores abertos para usar os novos catálogos.

Não publicar o novo seletor antes da migração. A reordenação dos campos dos detalhes do lead já foi publicada separadamente.

## Validação

- `scripts/tests/crm-pipeline-tags-db.mjs`: banco PostgreSQL temporário; verifica preservação de vínculos, etiquetas de automações, independência de edição e exclusão, filtros ao copiar leads, RLS por pipeline e proprietário.
- `src/hooks/__tests__/usePipelineTags.test.ts`: cache separado por pipeline, troca de contexto e filtros em criação/alteração/exclusão.
- TypeScript e lint sem erros.
