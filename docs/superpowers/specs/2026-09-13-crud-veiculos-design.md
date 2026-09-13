# CRUD de Veículos — Spec de Design

**Data:** 2026-09-13
**Status:** Aprovado, aguardando plano de implementação

## Contexto

A Fundação do painel do lojista (auth, roteamento protegido, deploy) está completa e no ar. Este é o segundo sub-projeto do roteiro: dar ao lojista uma forma de gerenciar o estoque de veículos da própria loja — cadastrar, listar, editar e excluir. A tabela `veiculos` já existe no back-end (Supabase) e já é usada em produção pelo agente de IA (n8n) para responder clientes via WhatsApp; este sub-projeto não altera o schema nem a lógica do agente.

Diferente da Fundação (que não tinha lógica de negócio própria), este sub-projeto tem validação de dados real — por isso passa a usar TDD a partir daqui, conforme já registrado no `CLAUDE.md`.

## Objetivo desta entrega

Ao final, o lojista consegue: ver a lista de veículos da própria loja, cadastrar um veículo novo (manualmente ou parcialmente pré-preenchido via consulta de placa), editar um veículo existente, e excluí-lo — tudo isolado por `loja_id` (RLS já garante isso no banco).

## Fora de escopo (fica pra sub-projetos futuros)

- Reordenação manual dos veículos na listagem (`ordem` fica no valor default; drag-and-drop fica pra quando a Vitrine Pública precisar disso).
- Qualquer UI pública de exibição dos veículos (`destaque`, `foto_capa`, etc. são gravados aqui, mas só são *consumidos* pela Vitrine Pública, sub-projeto 3).
- Regras de negócio de estoque além de validação de campos (ex.: placa duplicada) — não há necessidade concreta identificada ainda.
- Suporte a múltiplos usuários por loja (`user_id` fica sem uso; hoje a relação loja↔usuário é 1:1 via o trigger `handle_new_user`).
- Migrar o agente de IA (n8n) para usar `ano_fabricacao`/`ano_modelo` e remover a coluna `ano` — fica registrado como pendência futura (ver "Decisões e pendências").

## Schema da tabela `veiculos` (back-end existente, referência)

Colunas relevantes para este sub-projeto (schema completo confirmado via Supabase Table Editor):

| Coluna | Tipo | Uso neste sub-projeto |
|---|---|---|
| `id` | uuid | gerado automaticamente |
| `loja_id` | uuid (FK `lojas.id`) | preenchido a partir da sessão do lojista logado |
| `marca`, `modelo`, `versao` | text | formulário |
| `ano_fabricacao`, `ano_modelo` | int4 | formulário (substituem `ano`, ver pendência) |
| `cor` | text | formulário |
| `km` | int4 | formulário |
| `combustivel`, `cambio`, `carroceria` | text | formulário (select) |
| `portas` | int4 | formulário |
| `placa` | text | formulário, com consulta automática via API Placas |
| `placa_final` | text | derivado de `placa` no código, não é campo de formulário |
| `preco`, `preco_promocional` | numeric | formulário |
| `aceita_troca`, `destaque` | bool | formulário (switch) |
| `descricao` | text | formulário (textarea) |
| `opcionais` | text[] | formulário (tags) |
| `status` | text | formulário (select: `disponivel`/`reservado`/`vendido`/`inativo`) |
| `fotos` | text[] | upload no Supabase Storage |
| `foto_capa` | text | escolhida entre as `fotos` |
| `titulo` | text | gerado automaticamente (`marca` + `modelo` + `ano_modelo`) |
| `ordem` | int4 | fica no default (0), fora do formulário |
| `created_at`, `updated_at` | timestamptz | automáticos |
| `user_id` | uuid | **não usado** (ver "Decisões e pendências") |
| `ano` | int4 | **não usado** (ver "Decisões e pendências") |

## Arquitetura

- **Stack:** o mesmo da Fundação (React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + React Router + `@supabase/supabase-js`), sem mudanças de infraestrutura.
- **Rotas novas** (dentro da área protegida): `/veiculos` (listagem), `/veiculos/novo` (cadastro), `/veiculos/:id/editar` (edição, mesmo componente de formulário do cadastro).
- **Testes:** Vitest (integra nativamente com Vite) + React Testing Library, adicionados como dependência de desenvolvimento neste sub-projeto (o projeto ainda não tinha nenhum test runner).
- **Componentes shadcn/ui novos** (adicionados via CLI do shadcn na implementação): `table`, `dialog`, `select`, `textarea`, `switch`, `badge`, `form`, `sonner` (toast).
- **Bibliotecas novas:** `react-hook-form` + `zod` + `@hookform/resolvers` (formulário e validação).

## Componentes

- `src/lib/veiculos.ts` — funções de acesso a dados: `listVeiculos`, `createVeiculo`, `updateVeiculo`, `deleteVeiculo`, mais upload/remoção de fotos no Supabase Storage.
- `src/hooks/useVeiculos.ts` — hook de listagem (estado de loading/erro/refetch), seguindo o mesmo padrão de `useAuth.ts`.
- `src/lib/veiculo-schema.ts` — schema Zod de validação, testável isoladamente da UI.
- `src/pages/Veiculos.tsx` — listagem em tabela (marca/modelo/ano/preço/status), com ações de editar/excluir por linha e botão "Novo veículo".
- `src/pages/VeiculoForm.tsx` — formulário de criação/edição (mesmo componente, reaproveitado pelas duas rotas).
- `src/components/veiculos/` — subcomponentes do formulário (ex.: seção de fotos, seletor de correspondências Fipe) se o formulário principal crescer demais.
- `api/consulta-placa.ts` — Vercel Serverless Function que faz proxy da consulta à API Placas (`wdapi2.com.br`), mantendo o token fora do código do front-end.

## Campos do formulário

**Preenchidos pelo lojista** (todos os campos abaixo continuam editáveis mesmo quando pré-preenchidos pela consulta de placa):

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `marca` | texto | sim | |
| `modelo` | texto | sim | |
| `versao` | texto | não | ex: "Titanium", "GLS" |
| `ano_fabricacao` | número | sim | |
| `ano_modelo` | número | sim | |
| `cor` | texto | não | |
| `km` | número | não | ≥ 0 |
| `combustivel` | select | não | Gasolina/Etanol/Flex/Diesel/Híbrido/Elétrico |
| `cambio` | select | não | Manual/Automático/CVT |
| `carroceria` | select | não | Sedã/Hatch/SUV/Picape/etc. |
| `portas` | número | não | |
| `placa` | texto | não | validação de formato (`AAA0X00` ou `AAA9999`) |
| `preco` | número | sim | > 0 |
| `preco_promocional` | número | não | se preenchido, deve ser < `preco` |
| `aceita_troca` | switch | — | default false |
| `destaque` | switch | — | default false (consumido pela Vitrine, sub-projeto 3) |
| `descricao` | textarea | não | |
| `opcionais` | tags/checklist | não | array de texto |
| `status` | select | — | disponivel/reservado/vendido/inativo, default disponivel |
| `fotos` + `foto_capa` | upload de imagem | não | múltiplas fotos + escolha da capa |

**Gerenciados automaticamente (fora do formulário):** `id`, `created_at`, `updated_at`, `loja_id` (da sessão), `titulo` (gerado de `marca` + `modelo` + `ano_modelo`), `placa_final` (derivado de `placa`), `ordem` (default 0).

**Fora de uso por decisão:** `user_id`, `ano` (ver "Decisões e pendências").

## Integração com a API Placas (consulta por placa)

O lojista pode, opcionalmente, informar a placa e clicar em **"Buscar dados"** para pré-preencher o formulário a partir da [API Placas](https://apiplacas.com.br/doc.php) (endpoint `GET https://wdapi2.com.br/consulta/{placa}/{token}`).

**Segurança do token:** a consulta é feita por uma Vercel Serverless Function (`api/consulta-placa.ts`) que guarda o token da API Placas como variável de ambiente do projeto Vercel (nunca como `VITE_*`, que iria pro bundle público). O front-end chama essa rota interna, nunca a API externa diretamente.

**Fluxo:**
1. Lojista digita a placa e clica "Buscar dados" (não é automático a cada tecla — evita gastar consultas pagas à toa).
2. Validação de formato local antes de chamar a API.
3. A rota interna repassa a chamada e devolve o JSON já tratado.
4. **Se houver uma única correspondência (ou nenhuma) em `fipe.dados[]`:** preenche direto `marca`, `modelo`, `ano_fabricacao`, `ano_modelo`, `cor`, `combustivel` — e `cambio`/`carroceria` somente se a API os retornar preenchidos (a documentação avisa que costumam vir vazios).
5. **Se houver múltiplas correspondências em `fipe.dados[]`** (a mesma placa pode casar com mais de uma versão/motorização na Tabela Fipe): mostra uma lista com o texto de cada versão (`texto_modelo`) e o valor Fipe de referência, ordenada pelo `score` (maior primeiro, pré-selecionado). Ao escolher, preenche `versao`; o valor Fipe aparece como número de referência ao lado do campo `preco` — apoio à decisão, não substitui o preço de venda.
6. **Erros:** placa não encontrada (406) → "Placa não encontrada. Preencha os dados manualmente."; formato inválido (401) → erro inline no próprio campo, sem chamar a API; qualquer outro erro (token/limite/indisponibilidade) → mensagem genérica de indisponibilidade, sem detalhe técnico.
7. A busca é sempre **opcional** — nunca bloqueia o cadastro manual.

## Fluxo de dados

- **Listagem (`/veiculos`):** `useVeiculos` busca `select * from veiculos where loja_id = <loja da sessão>` (RLS garante o isolamento). Erro de rede/consulta → mensagem inline com botão "tentar novamente".
- **Criação (`/veiculos/novo`):** formulário vazio → busca opcional por placa → preenchimento manual/ajuste → validação Zod no submit → `createVeiculo()` insere a linha (`loja_id` da sessão) → upload de fotos no Storage, se houver → toast de sucesso → redireciona para `/veiculos`.
- **Edição (`/veiculos/:id/editar`):** carrega o veículo por `id` (RLS bloqueia acesso a veículo de outra loja → tela de "veículo não encontrado") → mesmo formulário pré-preenchido → `updateVeiculo()`.
- **Exclusão:** confirmação via `dialog` (ação destrutiva) → `deleteVeiculo()` remove a linha e as fotos associadas no Storage.

## Tratamento de erros

- Validação de campos: inline por campo, mensagens em português (React Hook Form + Zod).
- Upload de foto com falha: erro inline na seção de fotos, sem bloquear o salvamento do restante dos dados.
- Consulta de placa: ver seção específica acima.
- Erros inesperados: cobertos pelo Error Boundary genérico já existente da Fundação.

## Testes

A partir deste sub-projeto, TDD guia a implementação (`Vitest` + `React Testing Library`, adicionados aqui):

- `veiculo-schema.test.ts` — validação Zod (obrigatórios, tipos, formatos, `preco_promocional < preco`, `km >= 0`), sem UI nem rede.
- `veiculos.test.ts` (`src/lib/veiculos.ts`) — funções de acesso a dados, com o client do Supabase mockado.
- `api/consulta-placa` — parsing da resposta (incluindo múltiplas correspondências Fipe) e mapeamento de erros (401/406/402/429), com a chamada HTTP externa mockada.
- Páginas (listagem/formulário): teste de integração leve (render + interação) cobrindo os fluxos principais — criar, editar, excluir, buscar por placa.

## Decisões e pendências

- **`ano` vs `ano_fabricacao`/`ano_modelo`:** o agente de IA (n8n, produção) hoje só usa `ano` — `ano_fabricacao`/`ano_modelo` não são referenciados em nenhum workflow ativo. Decisão: o formulário passa a usar `ano_fabricacao`/`ano_modelo` a partir de agora. **Pendência futura (fora deste sub-projeto):** atualizar o workflow n8n do agente para usar `ano_fabricacao`/`ano_modelo` e então remover a coluna `ano`, que ficará sem uso.
- **`user_id`:** deixado fora do formulário (fica `NULL`). Hoje a relação loja↔usuário é 1:1 (trigger `handle_new_user`), então não há necessidade de rastrear qual usuário cadastrou o veículo. Revisitar se um dia a loja tiver múltiplos usuários.
- **`placa_final`:** não é um campo do formulário — é derivado de `placa` no código (últimos caracteres, para exibição parcial futura na vitrine pública sem expor a placa completa).
- **`titulo`:** não é um campo do formulário — gerado automaticamente a partir de `marca` + `modelo` + `ano_modelo` ao salvar.
- **Regras de estoque:** por ora, só validação de campos. Nenhuma regra de negócio adicional (ex.: placa duplicada) foi identificada como necessária; fica pra quando surgir um caso real.

## Próximos sub-projetos (fora de escopo aqui, só pra contexto)

1. Fundação ✅
2. CRUD de veículos (este documento).
3. Vitrine pública com CTA de WhatsApp.
4. Dashboard CRM (histórico de conversa, temperatura do lead, assumir conversa).
5. Billing (Stripe) + landing page.
