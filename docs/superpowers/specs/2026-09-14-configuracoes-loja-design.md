# Configurações da Loja — Spec de Design

**Data:** 2026-09-14
**Status:** Aprovado, aguardando plano de implementação

## Contexto

O roteiro original tinha como item 3 "Vitrine pública com CTA de WhatsApp", incluindo a tarefa de reordenação manual dos veículos (adiada do CRUD de veículos). Ao detalhar esse item, ficou claro que ele exigia antes uma forma do lojista preencher os dados cadastrais da própria loja (nome, WhatsApp, endereço, aparência, textos e imagens da vitrine, SEO, redes sociais, tracking) — nenhuma dessas informações tem hoje uma tela no painel, embora a tabela `lojas` já tenha todas as colunas necessárias.

Por isso o item 3 do roteiro foi dividido em três sub-projetos menores, cada um com spec, plano e implementação próprios, terminando em algo visível e testável:

- **3a. Configurações da loja** (este documento) — tela para editar todos os campos da loja.
- **3b. Reordenação manual dos veículos** — drag-and-drop na listagem `/veiculos`, definindo a coluna `ordem`.
- **3c. Vitrine pública** (`/v/:slug`) — consome os dados de 3a e a ordem de 3b, com CTA de WhatsApp por veículo.

Este documento cobre apenas o 3a.

## Objetivo desta entrega

Ao final, o lojista acessa `/configuracoes` (rota protegida) e consegue ver e editar todos os dados cadastrais da própria loja: identidade, contato, endereço, horários de funcionamento, aparência (logo/banner/cores), textos e imagem de destaque da futura vitrine, SEO e redes sociais, e IDs de tracking (Meta Pixel / Google Tag). A linha em `lojas` já existe (criada pelo trigger `handle_new_user` no cadastro) — esta tela é só leitura+edição, nunca criação.

## Fora de escopo (fica pra sub-projetos futuros)

- O toggle `vitrine_publica` — fica pro sub-projeto 3c, onde ligar/desligar a vitrine tem efeito visível de fato (a URL pública passa a funcionar ou não). Nesta entrega o campo nem aparece no formulário.
- Qualquer UI pública de exibição da loja ou dos veículos — sub-projeto 3c.
- Reordenação dos veículos (`ordem`) — sub-projeto 3b.
- Suporte a vídeo no campo de imagem de destaque da vitrine (`vitrine_destaque_url`) — só imagem por agora; `vitrine_destaque_tipo` fica sempre fixo em `'imagem'`, gravado internamente, sem campo próprio no formulário.
- Renderização de tags `<meta>` (OG/SEO) de fato na página pública, ou injeção dos scripts de tracking — isso é consumo desses dados, que só existe no sub-projeto 3c. Aqui só gravamos os valores.
- Validação assíncrona de unicidade do slug enquanto o lojista digita — a unicidade é garantida pela constraint `UNIQUE` do banco; o erro é tratado na resposta do `update` (ver seção "Slug").

## Schema da tabela `lojas` (back-end existente, referência)

| Coluna | Tipo | Uso nesta entrega |
|---|---|---|
| `id` | uuid | não usado no formulário (é `auth.uid()`, relação 1:1) |
| `user_id` | uuid | usado para filtrar a query (`eq('user_id', ...)`) |
| `nome_loja` | text | formulário — **único campo obrigatório** |
| `descricao` | text | formulário |
| `telefone_contato` | text | formulário |
| `email_contato` | text | formulário |
| `logradouro`, `numero`, `bairro`, `cidade`, `estado`, `cep` | text | formulário (endereço estruturado) |
| `endereco` | text | **não usado** — coluna legada, substituída pelos campos estruturados acima |
| `google_maps_link` | text | formulário |
| `horario_semana_abertura`, `horario_semana_fechamento`, `horario_sabado_abertura`, `horario_sabado_fechamento`, `horario_domingo_abertura`, `horario_domingo_fechamento` | text | formulário (inputs `type="time"`, vazio = fechado nesse dia) |
| `logo_url`, `banner_url` | text | formulário (upload de imagem) |
| `cor_primaria`, `cor_secundaria` | text | formulário (color picker) |
| `slug` | text | formulário, com sugestão automática (ver seção "Slug") |
| `vitrine_headline`, `vitrine_subheadline`, `vitrine_cta_texto`, `vitrine_cta_destino` | text | formulário |
| `vitrine_destaque_url` | text | formulário (upload de imagem) |
| `vitrine_destaque_tipo` | text | gravado automaticamente como `'imagem'`, sem campo no formulário |
| `meta_titulo`, `meta_descricao` | text | formulário |
| `og_image_url` | text | formulário (upload de imagem) |
| `instagram_url`, `facebook_url`, `tiktok_url`, `youtube_url` | text | formulário |
| `meta_pixel_id`, `google_tag_id` | text | formulário |
| `vitrine_publica` | bool | **fora do formulário** (ver "Fora de escopo") |
| `created_at` | timestamptz | automático, não usado no formulário |

## Arquitetura

- **Stack:** a mesma do CRUD de veículos — React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (`base-nova`) + React Router + `@supabase/supabase-js` + React Hook Form + Zod + Vitest + React Testing Library.
- **Rota nova** (protegida): `/configuracoes`.
- **Componente shadcn novo:** `tabs` (adicionado via CLI do shadcn na implementação).
- **Sem bibliotecas novas** além do que o CRUD de veículos já trouxe.

## Estrutura da tela — abas por assunto

Um único formulário (um schema Zod, um botão "Salvar"), mas organizado em abas para não virar uma página enorme de rolagem:

1. **Dados básicos** — `nome_loja`, `descricao`, `telefone_contato`, `email_contato`
2. **Endereço** — `logradouro`, `numero`, `bairro`, `cidade`, `estado`, `cep`, `google_maps_link`
3. **Horários** — os 6 campos de abertura/fechamento (segunda a sexta, sábado, domingo)
4. **Aparência** — `logo_url`, `banner_url` (upload), `cor_primaria`, `cor_secundaria`
5. **Vitrine** — `slug`, `vitrine_headline`, `vitrine_subheadline`, `vitrine_cta_texto`, `vitrine_cta_destino`, imagem de destaque (`vitrine_destaque_url`, upload)
6. **SEO** — `meta_titulo`, `meta_descricao`, `og_image_url` (upload)
7. **Redes sociais** — `instagram_url`, `facebook_url`, `tiktok_url`, `youtube_url`
8. **Tracking** — `meta_pixel_id`, `google_tag_id`

Único campo obrigatório: `nome_loja`. Todos os demais são opcionais (refletem o `Nullable` do schema do banco).

## Slug — sugestão automática

- Enquanto o campo `slug` estiver vazio, ele é sugerido automaticamente a partir de `nome_loja` conforme o lojista digita (ex.: "Auto Center Silva" → `auto-center-silva`): minúsculas, sem acento, espaços e caracteres inválidos trocados por hífen, hífens repetidos colapsados.
- No momento em que o lojista edita o campo `slug` manualmente, a sugestão automática para de atualizar (não sobrescreve o que ele escreveu).
- Validação de formato (Zod, local): só letras minúsculas, números e hífen (`/^[a-z0-9-]+$/`), sem hífen no início/fim.
- Unicidade: `slug` já tem constraint `UNIQUE` no banco. Ao salvar, se o Postgres rejeitar por duplicidade (código de erro `23505`), a UI mostra erro inline no campo `slug`: "Esse endereço já está em uso, escolha outro." Nenhuma verificação assíncrona antecipada é feita.

## Upload de imagens — novo bucket `lojas-imagens`

Quatro campos de imagem (`logo_url`, `banner_url`, `vitrine_destaque_url`, `og_image_url`), mesmo padrão do upload de fotos de veículo (`veiculo-fotos.ts`).

**Pendência de back-end (rodar antes da implementação, no SQL Editor do Supabase):**

```sql
insert into storage.buckets (id, name, public)
values ('lojas-imagens', 'lojas-imagens', true);

create policy "Dono gerencia imagens da própria loja"
on storage.objects for all
using (bucket_id = 'lojas-imagens' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'lojas-imagens' and (storage.foldername(name))[1] = auth.uid()::text);
```

- `src/lib/loja-imagens.ts`: `uploadImagemLoja(lojaId: string, campo: string, arquivo: File): Promise<string>` grava em `{lojaId}/{campo}/{uuid}.{ext}`; `removerImagemLoja(url: string): Promise<void>` remove pela URL — mesma dupla de funções de `veiculo-fotos.ts`, só troca o bucket e o path (aqui não há um segundo nível de "veiculoId", o path usa o nome do campo).
- Cada campo de imagem tem preview + botão de remover; trocar por uma nova imagem remove a antiga do Storage.
- Falha de upload: erro inline na seção da imagem específica, sem bloquear o salvamento do restante do formulário (mesmo tratamento do CRUD de veículos).

## Componentes

- `src/lib/loja-schema.ts` — schema Zod (`lojaSchema`, `type LojaFormValues`), testável isoladamente da UI.
- `src/lib/loja.ts` — `getLoja(): Promise<Loja | null>`, `updateLoja(payload: LojaPayload): Promise<Loja>` (usa `supabase.from('lojas').update(payload).eq('user_id', userId).select().single()`; RLS já garante isolamento).
- `src/lib/loja-imagens.ts` — upload/remoção de imagens (ver seção acima).
- `src/lib/slug.ts` — `gerarSlug(nome: string): string`, testável isoladamente.
- `src/hooks/useLoja.ts` — hook de carregamento, mesmo padrão de `useVeiculos` (`{ loja, carregando, erro, recarregar }`).
- `src/pages/Configuracoes.tsx` — a tela em si, com as abas descritas acima.
- `src/components/ui/tabs.tsx` — componente shadcn novo.
- Rota `/configuracoes` (dentro da área protegida) + link no `Dashboard.tsx`.

## Fluxo de dados

- **Carregamento:** ao montar, `useLoja` chama `getLoja()` (RLS: `lojas.user_id = auth.uid()`) e preenche o formulário (`form.reset(loja)`). Erro de rede/consulta → mensagem inline com botão "tentar novamente" (mesmo padrão da listagem de veículos).
- **Edição e envio:** lojista navega entre as abas (mesmo formulário, estado único) → ajusta campos → clica "Salvar" → validação Zod → uploads de imagem pendentes são resolvidos primeiro → `updateLoja()` grava a linha → toast de sucesso. A tela permanece a mesma (não há lista para redirecionar).
- **Erro ao salvar:** mensagem inline genérica no formulário, exceto o erro de slug duplicado (código `23505`), que aparece no campo `slug` especificamente.

## Testes

TDD, como no CRUD de veículos (Vitest + React Testing Library):

- `loja-schema.test.ts` — validação Zod (obrigatório `nome_loja`, formato de `slug`, formatos de URL nos campos de redes sociais, opcionais tratando vazio como não informado).
- `slug.test.ts` — `gerarSlug` (acentos, espaços, caracteres inválidos, hífens repetidos).
- `loja.test.ts` — `getLoja`/`updateLoja` com o client do Supabase mockado, incluindo o caso de erro `23505` mapeado para mensagem amigável.
- `loja-imagens.test.ts` — upload/remoção, mesmo padrão de `veiculo-fotos.test.ts`.
- `Configuracoes.test.tsx` — teste de integração leve: carrega dados existentes, edita um campo em cada aba relevante, salva, e cobre o caso de erro de slug duplicado.

## Decisões e pendências

- **`endereco` (coluna legada):** não é usado neste formulário — foi substituído pelos campos estruturados (`logradouro`, `numero`, `bairro`, `cidade`, `estado`, `cep`). Fica sem uso; não é removido do banco (fora de escopo).
- **`vitrine_destaque_tipo`:** sempre gravado como `'imagem'` ao salvar uma imagem de destaque; não é um campo do formulário. Revisitar se um dia houver suporte a vídeo.
- **`vitrine_publica`:** deliberadamente fora desta entrega — entra no sub-projeto 3c, onde ativar/desativar tem efeito visível.
- **Bucket `lojas-imagens`:** precisa ser criado manualmente no Supabase antes da implementação (SQL na seção correspondente) — mesmo padrão do pendency já resolvido para `veiculos-fotos`.

## Próximos sub-projetos (fora de escopo aqui, só pra contexto)

1. Fundação ✅
2. CRUD de veículos ✅
3. Vitrine pública com CTA de WhatsApp, dividido em:
   - 3a. Configurações da loja (este documento).
   - 3b. Reordenação manual dos veículos.
   - 3c. Vitrine pública (`/v/:slug`).
4. Dashboard CRM (histórico de conversa, temperatura do lead, assumir conversa).
5. Billing (Stripe) + landing page.
