# Billing (Asaas) — Spec de Design

**Data:** 2026-09-15
**Status:** Aprovado, aguardando plano de implementação

## Contexto

O roteiro original (item 5) previa "Billing (Stripe) + landing page", dividido em dois sub-projetos: 5a (Landing page, já completo) e 5b (Billing), aqui detalhado. Durante o brainstorming, o gateway foi trocado de Stripe para **Asaas**: para o público-alvo (revendas de veículos seminovos no Brasil), suporte nativo a Pix e boleto — que a Stripe não oferece no Brasil, só cartão de crédito recorrente — reduz a fricção do primeiro cliente pagante de verdade que o projeto está buscando. "Billing (Stripe)" no `CLAUDE.md` era só um nome provisório de quando o roteiro foi esboçado; esta spec corrige a nomenclatura para "Billing (Asaas)".

Hoje não existe nenhum conceito de plano, assinatura ou cobrança no produto — toda loja cadastrada tem acesso completo e permanente ao painel. Este sub-projeto introduz o primeiro modelo de monetização: plano único com trial gratuito.

## Objetivo desta entrega

Ao final, toda loja nova tem um trial gratuito de 7 dias a partir do cadastro. Durante o trial, o painel funciona normalmente. Ao vencer o trial sem uma assinatura ativa, a loja entra em **modo leitura**: o lojista continua enxergando seus dados (dashboard, leads, veículos, configurações), mas não consegue criar, editar ou excluir nada, e a vitrine pública (`/v/:slug`) exibe uma mensagem de indisponibilidade em vez do catálogo. Uma nova tela em `/assinatura` mostra o status atual (dias restantes de trial, ou "modo leitura"), um botão para assinar (que gera um link de pagamento hospedado pelo Asaas com Pix, boleto ou cartão) e o histórico de cobranças. Ao confirmar o primeiro pagamento, a loja recupera acesso completo automaticamente, sem intervenção manual.

## Fora de escopo (fica pra sub-projetos futuros)

- **Múltiplos planos/tiers** — só existe um plano (R$ 97/mês). Se o produto crescer e precisar de tiers com limites diferentes, isso é um sub-projeto futuro que reaproveita esta base.
- **Cancelamento pelo próprio lojista dentro do painel** — nesta entrega, cancelamento é tratado fora do produto (suporte manual). A tela `/assinatura` só cria assinaturas e mostra status/histórico; não tem botão de cancelar.
- **Alteração do workflow n8n do agente de WhatsApp** — o agente deveria parar de responder quando a loja está em modo leitura, mas o n8n vive fora deste repositório, em outro sistema. Esta spec documenta o contrato (função SQL `loja_tem_acesso_completo`) que o n8n deveria consultar, mas a mudança no workflow em si é um sub-projeto separado, fora deste escopo.
- **Formulário de cartão embutido no painel (Stripe/Asaas Elements-like)** — o pagamento acontece na página hospedada do Asaas, fora do domínio do ZapCar. Um formulário embutido é possível no futuro, mas não traz ganho relevante agora.
- **Notificações proativas de vencimento (email/WhatsApp avisando "seu trial acaba em 2 dias")** — nesta entrega a única sinalização é visual, dentro do próprio painel (banner). Lembretes automáticos por outro canal ficam para depois.
- **Reconciliação retroativa de cobranças perdidas** (ex.: webhook do Asaas falhou e nunca chegou) — assume-se que o webhook é confiável; um mecanismo de reconciliação/polling de segurança é um endurecimento futuro, não este MVP.

## Modelo de dados (Supabase, back-end fora deste repositório)

Novas colunas na tabela `lojas` existente (sem tabela nova — plano único não precisa de histórico normalizado; o histórico de cobranças vem direto da API do Asaas, sob demanda):

| Coluna | Tipo | Uso |
|---|---|---|
| `subscription_status` | text (enum via `CHECK`: `'trial'`, `'active'`, `'overdue'`, `'canceled'`) | Estado atual da assinatura. Todo cadastro novo começa em `'trial'` (default do trigger `handle_new_user`, que passa a gravar também `trial_ends_at`). |
| `trial_ends_at` | timestamptz | `created_at + interval '7 days'`, gravado uma única vez no cadastro. |
| `asaas_customer_id` | text, nulo | Preenchido na primeira chamada à Edge Function `criar-assinatura`. |
| `asaas_subscription_id` | text, nulo | Preenchido junto com `asaas_customer_id`. |

Uma função SQL `loja_tem_acesso_completo(p_loja_id uuid) returns boolean` centraliza a regra de acesso:

```sql
subscription_status = 'active'
  OR (subscription_status = 'trial' AND trial_ends_at > now())
```

Essa função é a única fonte de verdade sobre "a loja pode criar/editar", usada tanto pelas políticas RLS (seção abaixo) quanto, no futuro, pelo n8n. Rejeitada a alternativa de uma tabela `assinaturas` separada com histórico de períodos: normalizar histórico de assinaturas só compensa com múltiplos planos ou trocas de plano, nenhum dos quais existe aqui — o histórico de cobranças (não de "períodos de assinatura") já vem da API do Asaas quando precisa ser exibido.

## Supabase Edge Functions (back-end, entregues como código pra deploy manual)

Três funções Deno, seguindo o mesmo padrão de entrega dos SQLs de hardening anteriores (código pronto neste plano, deploy feito manualmente por fora):

1. **`criar-assinatura`** — chamada autenticada do painel quando o lojista clica "Assinar agora". Identifica a loja pelo JWT da sessão, cria o cliente no Asaas se `asaas_customer_id` ainda for nulo, cria uma cobrança recorrente mensal (R$ 97) e devolve a URL do link de pagamento hospedado. A API key do Asaas fica só como *secret* da função — nunca chega ao front-end.
2. **`webhook-asaas`** — endpoint público (sem autenticação de usuário; validado por um token de webhook configurado no Asaas) que recebe eventos de cobrança (`PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`/cancelamento). Localiza a loja por `asaas_subscription_id` e atualiza `subscription_status` (`'active'` em confirmação, `'overdue'` em atraso, `'canceled'` em cancelamento).
3. **`listar-cobrancas-asaas`** — chamada autenticada da tela `/assinatura` para listar o histórico de cobranças (data, valor, status) do `asaas_customer_id` da loja logada, direto da API do Asaas.

## Políticas RLS (endurecimento, back-end fora deste repositório)

Nas tabelas `veiculos`, `lojas_config_whatsapp`, `lojas_config_ia`, e nos campos editáveis de `lojas`: as políticas de `INSERT`, `UPDATE` e `DELETE` passam a exigir `loja_tem_acesso_completo(loja_id)` além do isolamento por `auth.uid()` já existente. `SELECT` continua liberado — os dados continuam visíveis em modo leitura, só a escrita é bloqueada. Isso garante que o bloqueio não dependa só da interface: mesmo uma chamada direta à API do Supabase (fora do painel) respeita o modo leitura.

## Frontend deste repositório

**Novos arquivos:**
- `src/hooks/useAssinatura.ts` — lê `subscription_status`/`trial_ends_at` da loja logada e expõe `{ status, diasRestantesTrial, temAcessoCompleto }`.
- `src/components/AssinaturaBanner.tsx` — banner persistente no layout do painel: contagem regressiva durante o trial ("Seu trial acaba em N dias"), ou aviso de modo leitura com link para `/assinatura` quando `!temAcessoCompleto`. Não aparece quando `status === 'active'`.
- `src/pages/Assinatura.tsx` (rota `/assinatura`, protegida) — mostra status atual, botão "Assinar agora" (chama `criar-assinatura` e redireciona `window.location.href` para a URL do Asaas devolvida) e a lista de cobranças (via `listar-cobrancas-asaas`).

**Arquivos modificados:**
- `App.tsx` — nova rota `/assinatura` (dentro de `ProtectedRoute`).
- Layout do painel (onde já vive alguma navegação comum, ex. o wrapper usado por `Dashboard`/`Veiculos`/`Leads`) — inclui `<AssinaturaBanner />`.
- `src/pages/VeiculoForm.tsx` e as rotas `/veiculos/novo` e `/veiculos/:id/editar` — redirecionam para `/assinatura` quando `!temAcessoCompleto` (mesmo padrão de guarda que `ProtectedRoute`/`PublicHomeRoute`), e o botão "Novo veículo" em `/veiculos` fica desabilitado com uma dica ("assinatura necessária").
- `src/pages/Configuracoes.tsx` — botão "Salvar" desabilitado quando `!temAcessoCompleto`.
- `src/pages/Vitrine.tsx` — antes de renderizar o catálogo, verifica `loja_tem_acesso_completo` (via uma coluna/consulta que exponha esse booleano para a rota pública, já que `/v/:slug` não tem sessão autenticada) e exibe uma mensagem neutra ("Esta vitrine está indisponível no momento") em vez do catálogo, quando a loja está em modo leitura.

A verificação de acesso na vitrine pública, sem sessão de usuário, precisa de uma forma segura de consultar `loja_tem_acesso_completo` publicamente — a função SQL é marcada `SECURITY DEFINER` e exposta via RPC do Supabase (`supabase.rpc('loja_tem_acesso_completo', { p_loja_id })`), sem expor `subscription_status` bruto nem outros dados sensíveis da loja.

## Fluxo ponta a ponta

1. Lojista se cadastra → trigger `handle_new_user` grava `subscription_status = 'trial'` e `trial_ends_at = now() + 7 days`.
2. Painel funciona normalmente durante o trial; o banner mostra a contagem regressiva ("Seu trial acaba em N dias") durante todo o período de trial, não só nos últimos dias.
3. Trial vence sem pagamento → `temAcessoCompleto` passa a `false` (calculado no front a partir de `trial_ends_at`, sem esperar nenhum job). Banner muda para aviso de modo leitura; RLS já bloqueia escritas independente do front.
4. Lojista acessa `/assinatura`, clica "Assinar agora" → Edge Function `criar-assinatura` cria cliente+cobrança no Asaas → redireciona para o link hospedado.
5. Lojista paga via Pix, boleto ou cartão na página do Asaas → Asaas confirma e chama `webhook-asaas` → `subscription_status` vira `'active'`.
6. Próximo carregamento do painel: `temAcessoCompleto` volta a `true`, banner some, ações voltam a funcionar.
7. Cobranças futuras (renovação mensal) seguem o mesmo webhook; atraso de pagamento (`PAYMENT_OVERDUE`) leva de volta a `subscription_status = 'overdue'`, reativando o modo leitura até a regularização.

## Testes

Seguindo a convenção do projeto (TDD para lógica de negócio real, verificação manual para conteúdo estático e integração externa):

- **TDD:** `useAssinatura` (cálculo de `temAcessoCompleto`/`diasRestantesTrial` para cada combinação de `subscription_status`/`trial_ends_at`), `AssinaturaBanner` (texto certo por status), a guarda de redirecionamento em `VeiculoForm`/rotas de veículo, o desabilitar do botão "Salvar" em `Configuracoes`, e a mensagem de indisponibilidade em `Vitrine`.
- **Testes de unidade nas Edge Functions:** lógica de mapeamento dos eventos do webhook Asaas (`PAYMENT_CONFIRMED`/`PAYMENT_OVERDUE`/`PAYMENT_DELETED` → `subscription_status` correspondente), isolada da chamada de rede real.
- **Verificação manual:** fluxo ponta-a-ponta completo com o ambiente sandbox do Asaas (criar assinatura, pagar via Pix de teste, confirmar que o webhook chega e libera o acesso) — não dá para automatizar uma cobrança real de sandbox no CI deste projeto.

## Convenções deste projeto (reafirmadas)

- Toda mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- `Button`/`DialogTrigger` como link ou disparador de outro componente usam sempre a prop `render`, nunca `asChild` nem `onClick` + `window.open` (ver `CLAUDE.md` e commit `914bdd0`) — exceto o redirecionamento para a URL externa do Asaas em `Assinatura.tsx`, que por ser uma navegação de saída do site (fora do React Router) usa `window.location.href` diretamente, não um componente `Link`/`Button`.
