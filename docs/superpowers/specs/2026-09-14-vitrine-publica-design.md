# Vitrine Pública — Spec de Design

**Data:** 2026-09-14
**Status:** Aprovado, aguardando plano de implementação

## Contexto

O item 3 do roteiro ("Vitrine pública com CTA de WhatsApp") foi dividido em três sub-projetos menores, cada um com spec, plano e implementação próprios:

- **3a. Configurações da loja** ✅ completo — tela para editar todos os campos da loja, incluindo os textos/imagens/cores da futura vitrine.
- **3b. Reordenação manual dos veículos** ✅ completo — drag-and-drop em `/veiculos`, definindo a coluna `ordem`.
- **3c. Vitrine pública** (`/v/:slug`, este documento) — consome os dados de 3a e a ordem de 3b, com CTA de WhatsApp por veículo.

Este documento cobre apenas o 3c, a última entrega do item 3 do roteiro.

## Objetivo desta entrega

Qualquer visitante, sem login, acessa `/v/:slug` e vê a vitrine pública da loja: identidade visual (banner, logo, cores), headline/subheadline e CTA gerais, e a grade de veículos disponíveis/reservados na ordem definida em 3b — cada um com um botão que abre uma conversa de WhatsApp já preenchida sobre aquele veículo específico. O lojista ativa a vitrine em `/configuracoes` através de um switch novo (`vitrine_publica`, reintroduzido nesta entrega).

## Fora de escopo (fica pra revisitar depois, se necessário)

- Busca, filtro ou paginação na vitrine pública — o volume de veículos de uma revenda cabe numa página só por enquanto.
- Captura de lead diretamente na página (formulário, chat embutido) — o único ponto de contato é o clique que abre o WhatsApp.
- Suporte a vídeo no campo de imagem de destaque (`vitrine_destaque_url`) — já era fora de escopo desde o 3a (`vitrine_destaque_tipo` fixo em `'imagem'`).
- Renderização de tags OG/SEO para qualquer rota além de `/v/:slug` — a Fundação e as telas do painel não precisam de preview de link social.
- Qualquer alteração na coluna `status`/`ordem` a partir da vitrine pública — é uma tela somente leitura para o visitante.

## Back-end existente (referência — nenhuma migration necessária)

RLS já está pronta em produção para este sub-projeto (confirmado via `pg_policies`):

- `lojas`: policy `"vitrine publica leitura anonima"` — `SELECT` liberado para `anon`/`authenticated` quando `vitrine_publica = true`.
- `veiculos`: policy `"Vitrine pública lê veículos"` — `SELECT` liberado para `anon`/`authenticated` quando `status` está em `('disponivel', 'reservado', 'ativo')` **e** a loja correspondente tem `vitrine_publica = true`. (`'ativo'` é um valor legado que não existe em `STATUS_OPTIONS` do front — nunca vai aparecer na prática, mas a policy já cobre.)

Nenhuma tabela de configuração de WhatsApp (`lojas_config_whatsapp`) é usada aqui — essa tabela só guarda dados de conexão da Evolution API (`instance_name`, `qrcode`, `status`), sem número de telefone e sem leitura anônima liberada. O número usado no CTA é `lojas.telefone_contato`, já coberto pela policy de `lojas` acima.

## Arquitetura

- **Rota nova, sem autenticação:** `/v/:slug`, fora de `ProtectedRoute` em `App.tsx`.
- **Sem client Supabase novo:** a mesma instância de `src/lib/supabase.ts` funciona sem sessão logada — as duas policies acima usam a role `anon` automaticamente quando não há usuário autenticado.
- **Preview de link (OG/SEO) para bots, via serverless function:** como o front é uma SPA (Vite/React), tags `<meta>` inseridas via JS não são vistas por bots que não executam JavaScript (`facebookexternalhit`, `WhatsApp`, `Twitterbot`, `Slackbot`, `LinkedInBot`, `TelegramBot`, `Discordbot` — os que geram preview de link ao compartilhar). A solução:
  - `api/vitrine-preview.ts` (mesmo padrão de `api/consulta-placa.ts`, usando `@vercel/node`): recebe `slug`, busca `meta_titulo`/`meta_descricao`/`og_image_url` (com fallback pra `nome_loja`/`vitrine_headline` quando os campos de SEO estiverem vazios) e devolve um HTML mínimo com as tags `<meta property="og:*">` corretas. Loja não encontrada ou sem vitrine ativa → HTML mínimo genérico (sem dados da loja), status 200 (bots de preview não tratam bem 404).
  - `vercel.json` ganha uma regra de `rewrites` com `has: [{ "type": "header", "key": "user-agent", "value": "...regex dos bots..." }]` que redireciona `/v/:slug` para essa function **somente** quando o User-Agent bate com a lista de bots conhecidos. Todo o restante (visitantes humanos) cai na regra catch-all existente (`/(.*) → /index.html`), que já vem depois no arquivo — a ordem das regras importa, a nova entra antes da catch-all.
  - Nenhuma env var nova: a function lê `process.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, já configuradas na Vercel (o prefixo `VITE_` só controla o que o Vite embute no bundle do navegador; `process.env` em uma serverless function lê a env var do jeito que ela foi configurada no projeto, independente do prefixo).

## Dados consumidos

- `src/lib/vitrine.ts` (novo):
  - `getLojaPublica(slug: string): Promise<LojaPublica | null>` — `supabase.from('lojas').select('<colunas de LojaPublica>').eq('slug', slug).eq('vitrine_publica', true).maybeSingle()`. Retorna `null` tanto para slug inexistente quanto para vitrine desativada — a página não distingue os dois casos.
  - `listVeiculosPublicos(lojaId: string): Promise<Veiculo[]>` — mesma tabela `veiculos`, filtrada por `loja_id`, ordenada `ordem asc, created_at desc` (RLS já filtra por `status`/`vitrine_publica`).
- `LojaPublica` (tipo novo, em `vitrine.ts`) é o subconjunto de `Loja` (de `loja.ts`) usado pela página — sem `user_id` (não usado, e não há motivo pra expor o identificador do dono). Inclui `id`: não é exibido na tela, mas é necessário pra buscar os veículos daquela loja em `listVeiculosPublicos(loja.id)` — expor o `id` não é um risco novo, já que ele aparece do mesmo jeito em `veiculos.loja_id`, coluna já pública pela outra policy:

  ```ts
  type LojaPublica = Pick<Loja,
    | 'id'
    | 'nome_loja' | 'descricao'
    | 'telefone_contato'
    | 'logradouro' | 'numero' | 'bairro' | 'cidade' | 'estado' | 'cep' | 'google_maps_link'
    | 'horario_semana_abertura' | 'horario_semana_fechamento'
    | 'horario_sabado_abertura' | 'horario_sabado_fechamento'
    | 'horario_domingo_abertura' | 'horario_domingo_fechamento'
    | 'logo_url' | 'banner_url' | 'cor_primaria' | 'cor_secundaria'
    | 'vitrine_headline' | 'vitrine_subheadline' | 'vitrine_cta_texto' | 'vitrine_cta_destino' | 'vitrine_destaque_url'
    | 'meta_titulo' | 'meta_descricao' | 'og_image_url'
    | 'instagram_url' | 'facebook_url' | 'tiktok_url' | 'youtube_url'
    | 'meta_pixel_id' | 'google_tag_id'
  >
  ```

  A serverless function `api/vitrine-preview.ts` só precisa de `meta_titulo`, `meta_descricao`, `og_image_url`, `nome_loja` e `vitrine_headline` (para os fallbacks) — pode usar uma query própria, mais estreita, em vez de reaproveitar `LojaPublica` inteiro.

## CTA de WhatsApp por veículo

- `src/lib/whatsapp.ts` (novo):
  - `formatarNumeroWhatsapp(telefone: string | null): string | null` — remove todo caractere que não é dígito; se sobrarem 10 ou 11 dígitos (sem DDI), prefixa `55`; se o resultado tiver menos de 12 dígitos após a normalização, retorna `null` (número não confiável o bastante pra gerar um link).
  - `montarLinkWhatsapp(numero: string, mensagem: string): string` — `https://wa.me/<numero>?text=<mensagem codificada>`.
- Mensagem pré-preenchida por veículo: `"Olá! Vi o anúncio do {marca} {modelo} {ano_modelo} na vitrine e gostaria de mais informações."`.
- Se `telefone_contato` estiver vazio ou não normalizar para um número válido: a vitrine funciona normalmente, só sem os botões de WhatsApp nos cards (a página nunca quebra por causa disso).
- `telefone_contato` não tem validação de formato desde o 3a (é texto livre) — este sub-projeto não reabre o 3a; a normalização aqui é best-effort e assume números brasileiros.

## Layout da página

Decidido visualmente com o usuário (mockups comparados lado a lado): **grade de cards**, não lista compacta.

1. **Topo (banner):** fundo com gradiente/cor usando `cor_primaria`/`cor_secundaria` da loja (ou `banner_url` como imagem de fundo quando preenchido), `logo_url` centralizado, `vitrine_headline`/`vitrine_subheadline`, e um botão de CTA geral usando `vitrine_cta_texto`/`vitrine_cta_destino` (com fallback: texto "Fale com a gente" apontando pro mesmo número de WhatsApp, sem mensagem de veículo específico, quando os campos estiverem vazios).
2. **Grade de veículos:** cards em grid responsivo (3 colunas em desktop, colapsando pra 1 em mobile), cada card com: foto de capa (`foto_capa` ou primeira de `fotos`), título (`marca modelo versão`), km, preço (com `preco_promocional` riscando o `preco` original quando houver), badge "Reservado" quando `status === 'reservado'`, botão "WhatsApp" (escondido conforme a regra de `formatarNumeroWhatsapp` acima).
3. **Rodapé simples:** endereço estruturado (quando houver ao menos um campo preenchido) com link pro `google_maps_link`, horários de funcionamento formatados (dias sem horário preenchido aparecem como "Fechado"), ícones de redes sociais (`instagram_url`/`facebook_url`/`tiktok_url`/`youtube_url`, só os preenchidos).

**Veículo em destaque (`destaque = true`):** aparece na mesma grade, sem tratamento visual especial nesta entrega — decisão deliberada de manter simples (YAGNI); revisitar se o lojista pedir depois.

## Estados da página

- **Loja não encontrada ou vitrine desativada:** página "Vitrine não encontrada" — mensagem genérica, sem distinguir os dois casos, sem branding (não há dados da loja pra mostrar).
- **Loja pública, mas sem veículos disponíveis:** banner/topo aparece normal; no lugar da grade, mensagem "Nenhum veículo disponível no momento. Fale com a gente!" com o CTA geral do topo.
- **Erro de rede/consulta:** mensagem inline com botão "Tentar novamente" — mesmo padrão já usado no resto do painel (`useLoja`/`useVeiculos`).

## Toggle `vitrine_publica` (volta ao 3a)

- `lojaSchema` (`loja-schema.ts`) ganha o campo `vitrine_publica: z.coerce.boolean().default(false)`.
- Na aba "Vitrine" de `Configuracoes.tsx`, um switch "Vitrine pública ativa" acima do campo `slug`.
- O switch fica **desabilitado com uma dica** ("Defina um endereço antes de ativar") enquanto `slug` estiver vazio — evita salvar `vitrine_publica = true` sem um endereço pra acessar.

## Componentes e arquivos

- `src/lib/vitrine.ts` (novo) — `getLojaPublica`, `listVeiculosPublicos`, tipo `LojaPublica`.
- `src/lib/whatsapp.ts` (novo) — `formatarNumeroWhatsapp`, `montarLinkWhatsapp`.
- `src/pages/Vitrine.tsx` (novo) — a página: lê `:slug` da URL, carrega loja+veículos, trata os três estados, injeta `meta_pixel_id`/`google_tag_id` via `useEffect` quando presentes.
- `src/components/vitrine/CardVeiculo.tsx` (novo) — card individual da grade.
- `api/vitrine-preview.ts` (novo) — serverless function de preview OG para bots.
- `vercel.json` — nova regra de `rewrites` condicionada por User-Agent (antes da regra catch-all existente).
- `src/App.tsx` — rota `/v/:slug`, fora de `ProtectedRoute`.
- `src/lib/loja-schema.ts` — campo `vitrine_publica` de volta ao schema.
- `src/pages/Configuracoes.tsx` — switch `vitrine_publica` na aba "Vitrine".

## Testes

TDD, como no resto do projeto (Vitest + React Testing Library):

- `whatsapp.test.ts` — normalização (com/sem DDI, com máscara de parênteses/hífen/espaço, número inválido → `null`), montagem do link com mensagem codificada.
- `vitrine.test.ts` — `getLojaPublica`/`listVeiculosPublicos` com o client do Supabase mockado (caso encontrado, caso `null`).
- `CardVeiculo.test.tsx` — preço promocional riscando o original, badge "Reservado", botão de WhatsApp ausente quando o telefone não normaliza.
- `Vitrine.test.tsx` — os três estados (não encontrada, vazia, com veículos) e o link de WhatsApp do card montado com a mensagem correta.
- `vitrine-preview.test.ts` — a serverless function: loja encontrada e pública → HTML com as tags `<meta>` esperadas; loja não encontrada/vitrine desativada → HTML genérico, sem dados da loja.
- Ajuste em `loja-schema.test.ts` e `Configuracoes.test.tsx` — cobrir o campo/switch `vitrine_publica` novo (incluindo o caso desabilitado sem slug).

## Decisões e pendências

- **Layout escolhido visualmente com o usuário:** grade de cards (não lista compacta) — ver seção "Layout da página".
- **Número de WhatsApp:** `lojas.telefone_contato`, não `lojas_config_whatsapp` (essa tabela não tem número, só dados de conexão da Evolution API, sensíveis e sem leitura pública).
- **Preview de link (OG) só para bots conhecidos, via serverless function condicionada por User-Agent** — decisão registrada porque tags `<meta>` inseridas via JS não são lidas por esses bots; alternativa descartada foi deixar 100% client-side e aceitar preview genérico ao compartilhar o link (rejeitada pelo usuário, já que o principal canal de divulgação da vitrine é justamente compartilhar o link no WhatsApp).
- **Veículo em destaque sem tratamento visual especial nesta entrega** — YAGNI, revisitar se pedido depois.
- **`vitrine_publica` reintroduzido no schema/formulário do 3a** — deliberadamente deixado de fora naquela entrega; entra agora porque só aqui o efeito de ativar/desativar é visível de fato.

## Próximos sub-projetos (fora de escopo aqui, só pra contexto)

1. Fundação ✅
2. CRUD de veículos ✅
3. Vitrine pública com CTA de WhatsApp, dividido em:
   - 3a. Configurações da loja ✅
   - 3b. Reordenação manual dos veículos ✅
   - 3c. Vitrine pública (este documento).
4. Dashboard CRM (histórico de conversa, temperatura do lead, assumir conversa).
5. Billing (Stripe) + landing page.
