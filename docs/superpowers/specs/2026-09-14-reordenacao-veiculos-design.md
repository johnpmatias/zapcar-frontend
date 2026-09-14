# Reordenação Manual dos Veículos — Spec de Design

**Data:** 2026-09-14
**Status:** Aprovado, aguardando plano de implementação

## Contexto

O item 3 do roteiro ("Vitrine pública com CTA de WhatsApp") foi dividido em três sub-projetos menores, cada um com spec, plano e implementação próprios:

- **3a. Configurações da loja** ✅ completo — tela para editar todos os campos da loja.
- **3b. Reordenação manual dos veículos** (este documento) — drag-and-drop na listagem `/veiculos`, definindo a coluna `ordem`.
- **3c. Vitrine pública** (`/v/:slug`) — consome os dados de 3a e a ordem de 3b, com CTA de WhatsApp por veículo.

A coluna `ordem` (int4, default `0`) já existe na tabela `veiculos` desde o CRUD de veículos, mas nunca foi usada — todo veículo está com `ordem = 0` hoje. A reordenação foi deliberadamente adiada pra este sub-projeto porque só faz sentido de verdade quando existir uma listagem pública (3c) pra justificar a ordem escolhida; construí-la antes não teria nada visível pra mostrar. Este documento cobre apenas o 3b.

## Objetivo desta entrega

O lojista acessa `/veiculos` e consegue reordenar manualmente, por arrastar-e-soltar (mouse, toque ou teclado), os veículos com status `disponivel`/`reservado` — a ordem escolhida é persistida na coluna `ordem` e passa a valer como critério de ordenação da listagem. Veículos `vendido`/`inativo` continuam visíveis na mesma tela, numa seção separada, mas não participam da reordenação.

## Fora de escopo (fica pra sub-projetos futuros)

- Qualquer exibição pública da ordem — isso é o 3c (Vitrine pública), que vai *consumir* a coluna `ordem` que este sub-projeto passa a manter.
- Reordenar um veículo entre as duas seções (ex.: arrastar um "vendido" pra cima e ele virar "disponível") — mudar o `status` é uma ação separada, já existente na edição do veículo (`VeiculoForm.tsx`).
- Reordenação em lote/multi-seleção, ou desfazer (undo) de uma reordenação.
- Paginação/filtro da listagem de veículos — a tela não tem isso hoje e não é este sub-projeto que introduz.

## Schema da tabela `veiculos` (back-end existente, referência)

| Coluna | Tipo | Uso nesta entrega |
|---|---|---|
| `ordem` | int4 | passa a ser gravada de verdade (default `0` até a primeira reordenação); critério primário de ordenação da listagem |
| `status` | text (enum) | define em qual das duas seções o veículo aparece (`disponivel`/`reservado` → reordenável; `vendido`/`inativo` → estática) |
| `created_at` | timestamptz | critério de desempate da ordenação (mantém o comportamento atual enquanto `ordem` ainda não foi definida por ninguém) |

Nenhuma coluna nova, nenhuma migration — `ordem` já existe e já está fora do formulário de cadastro/edição de veículo (`VeiculoPayload` já a omite).

## Arquitetura

- **Stack:** a mesma do CRUD de veículos, mais uma dependência nova: `@dnd-kit/core` + `@dnd-kit/sortable` (drag-and-drop com suporte a mouse, toque e teclado, ativamente mantida e compatível com React 19 — ao contrário de `react-beautiful-dnd`, descontinuada).
- **Sem rota nova** — a mudança é toda dentro de `/veiculos`, que já existe.

## Separação em duas seções

`Veiculos.tsx` passa a dividir a lista em dois grupos, calculados a partir do `status` de cada veículo:

1. **"Disponíveis"** — veículos com `status` `disponivel` ou `reservado`. Lista reordenável (drag-and-drop via dnd-kit), renderizada como lista de cards (não mais `<table>`, pra funcionar bem em telas estreitas) com alça de arrastar (`⠿`) à esquerda de cada item. Mantém as mesmas informações e ações que a tabela já mostra hoje: marca, modelo, ano, preço, status, links de Editar/Excluir.
2. **"Vendidos/Inativos"** — veículos com `status` `vendido` ou `inativo`. Lista estática, sem alça de arrastar, mesmo layout de linha, só aparece quando há pelo menos um veículo nesse grupo.

**Estados vazios:**
- Nenhum veículo cadastrado (as duas seções vazias): mensagem atual, "Nenhum veículo cadastrado ainda."
- Só a seção "Vendidos/Inativos" tem itens: a seção "Disponíveis" mostra "Nenhum veículo disponível pra reordenar."

## Fluxo de dados — persistência ao soltar

1. `useVeiculos` passa a pedir ao Supabase `order('ordem', { ascending: true }).order('created_at', { ascending: false })` em vez de só `created_at desc` — o desempate por `created_at` garante que a ordem de hoje (tudo em `ordem = 0`) continue idêntica até a primeira reordenação.
2. Ao soltar um item arrastado, calcula-se a nova ordem sequencial (`0, 1, 2, …`) só para o subconjunto "Disponíveis". Compara-se com a `ordem` que cada veículo tinha antes do drag e só entram no update os que realmente mudaram de posição — minimiza `UPDATE`s.
3. `reorderVeiculos(atualizacoes: { id: string; ordem: number }[]): Promise<void>` (novo, em `src/lib/veiculos.ts`) dispara um `update` por linha alterada, em paralelo (`Promise.all`) — mesmo padrão simples do resto do arquivo, sem RPC/batch no Supabase.
4. **Salvamento é automático e otimista:** a UI já reflete a nova posição antes da resposta do Supabase. Um indicador discreto ("Salvando ordem...") aparece perto do item movido enquanto a chamada está em voo e some ao confirmar. Se a chamada falhar, a posição visual é revertida e um erro inline (`role="alert"`) aparece no topo da seção "Disponíveis" — mesmo padrão de erro já usado nas outras telas.

Isso resolve sozinho o problema de todo mundo estar em `ordem = 0` hoje: a primeira vez que o lojista arrasta qualquer coisa, a chamada já recalcula e grava a ordem sequencial de toda a seção "Disponíveis", não só do item movido.

## Teclado e acessibilidade

Com o item em foco (Tab até a alça), `Space` inicia o modo de arrastar do dnd-kit, as setas ↑/↓ movem o item entre as posições, e `Space` de novo confirma — comportamento padrão do sensor de teclado do dnd-kit, sem UI extra a construir (nada de botões separados de "mover pra cima/baixo").

## Componentes

- `src/lib/veiculos.ts` — nova função `reorderVeiculos` (ver "Fluxo de dados").
- `src/hooks/useVeiculos.ts` — muda só o `order()` da query (ver "Fluxo de dados").
- `src/components/veiculos/ListaReordenavel.tsx` (novo) — encapsula `DndContext`/`SortableContext` do dnd-kit; recebe a lista de veículos "Disponíveis" e um callback `onReordenar(novaOrdem: Veiculo[])`; não fala com o Supabase diretamente (isso fica na página).
- `src/pages/Veiculos.tsx` — separa os veículos em dois grupos por `status`, renderiza `ListaReordenavel` pro primeiro grupo e a lista estática pro segundo; guarda o estado otimista e chama `reorderVeiculos`.

## Testes

TDD, como no resto do projeto (Vitest + React Testing Library):

- `veiculos.test.ts` — casos novos para `reorderVeiculos`: chama `update` uma vez por item alterado, com o `ordem` correto; propaga erro se algum `update` falhar.
- `useVeiculos.test.ts` — confirma que a ordenação pedida ao Supabase agora é `ordem asc, created_at desc`.
- `ListaReordenavel.test.tsx` — componente isolado: renderiza os itens na ordem recebida; simulando o sensor de teclado do dnd-kit (`Space` → seta → `Space`), confirma que `onReordenar` é chamado com a nova ordem esperada. (Testar drag por mouse/touch de verdade em RTL é frágil; a via de teclado exercita a mesma lógica de reordenação de forma confiável.)
- `Veiculos.test.tsx` — confirma a separação em duas seções, os estados vazios de cada uma, e que uma reordenação bem-sucedida mostra e esconde o indicador "Salvando ordem..."; cobre também o caso de falha (reverte posição, mostra erro inline).

## Decisões e pendências

- **Biblioteca de drag-and-drop:** `@dnd-kit` escolhida em vez de HTML5 drag-and-drop nativo — decisão registrada porque o lojista usa o painel em mistura de desktop e celular, e o dnd-kit cobre toque e teclado nativamente, enquanto a API nativa do navegador tem suporte fraco a toque e nenhum a teclado.
- **Seção "Disponíveis" muda de `<table>` para lista de cards:** necessário pra funcionar bem em telas estreitas (uma tabela HTML não é arrastável de forma usável em mobile). A seção "Vendidos/Inativos" pode manter o mesmo layout de linha simplificado, sem virar uma tabela HTML separada, pra não duplicar dois padrões de marcação na mesma tela.
- **Sem migration:** a coluna `ordem` já existe desde o CRUD de veículos; esta entrega só passa a escrevê-la e a usá-la na ordenação.

## Próximos sub-projetos (fora de escopo aqui, só pra contexto)

1. Fundação ✅
2. CRUD de veículos ✅
3. Vitrine pública com CTA de WhatsApp, dividido em:
   - 3a. Configurações da loja ✅
   - 3b. Reordenação manual dos veículos (este documento).
   - 3c. Vitrine pública (`/v/:slug`).
4. Dashboard CRM (histórico de conversa, temperatura do lead, assumir conversa).
5. Billing (Stripe) + landing page.
