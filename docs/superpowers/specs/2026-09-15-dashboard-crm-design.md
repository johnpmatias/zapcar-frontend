# Dashboard CRM — Spec de Design

**Data:** 2026-09-15
**Status:** Aprovado, aguardando plano de implementação

## Contexto

Item 4 do roteiro. Com a Vitrine pública (item 3) completa, este é o primeiro sub-projeto do painel que toca as tabelas `leads` e `Interacoes` — nenhuma tela existente hoje fala com elas. Essas tabelas já são alimentadas e mantidas por três workflows n8n que rodam fora deste repositório:

- **`ZapCar - AgenteAtendimento`** — agente de atendimento via WhatsApp. Cria o lead na primeira mensagem, grava cada mensagem em `Interacoes` (`remetente`: `LEAD`/`LOJA`/`BOT`), e desliga o bot (`leads.bot_ativo = false`) automaticamente quando a IA identifica intenção forte de compra/pedido de humano, ou quando a própria loja responde manualmente pelo WhatsApp (fora do painel). Hoje **não existe** nenhum caminho automático pra religar o bot depois de desligado — uma vez `false`, fica `false` até alguém mudar isso manualmente.
- **`ZapCar - ResumoLeadsDiario`** — roda todo dia às 23h50, lê as interações do dia de cada lead, e usa uma IA pra gravar `leads.resumo_diario` (texto) e `leads.temperatura` (`Frio` | `Morno` | `Quente` | `Agendado`). Um lead recém-criado, antes da primeira execução desse workflow, fica com `temperatura` `NULL`.
- **`ZapCar - Gerador de QR Code`** — não é relevante para este sub-projeto (só conexão da instância do WhatsApp).

## Objetivo desta entrega

O lojista acessa `/leads` e vê um board Kanban com os leads da própria loja, agrupados por `temperatura`. Consegue reclassificar um lead manualmente arrastando o card entre colunas, abrir o histórico completo de conversa de um lead num painel lateral, e alternar entre "bot atendendo" e "assumi a conversa" — sem precisar mexer no banco diretamente.

## Fora de escopo (fica pra sub-projetos futuros)

- **Enviar mensagens de dentro do painel.** O painel só visualiza o histórico e controla `bot_ativo`; a troca de mensagens com o cliente continua acontecendo direto no WhatsApp da loja, como já acontece hoje quando um humano assume. Um chat embutido (exigindo integração de envio com a Evolution API) é um sub-projeto à parte, se algum dia fizer falta.
- **Atualização em tempo real.** O board e o histórico são carregados ao entrar na página / recarregar; não há assinatura Supabase Realtime nesta entrega.
- **Agendamentos.** A tabela `agendamentos` (visitas/test-drive marcados pela IA) não aparece nesta tela.
- **Reclassificação automática correr por cima da manual.** `ZapCar - ResumoLeadsDiario` continua rodando todo dia às 23h50 e pode sobrescrever uma `temperatura` que o lojista ajustou manualmente durante o dia — comportamento aceito, não é tratado por este sub-projeto (não há campo para "travar" a classificação).

## Schema das tabelas envolvidas (back-end existente, referência)

**`leads`**

| Coluna | Tipo | Uso nesta entrega |
|---|---|---|
| `id` | uuid | chave do lead |
| `loja_id` | uuid | escopo via RLS, já resolvido pelo hook `useLoja` |
| `nome` | text | exibido no card |
| `telefone` | text | exibido no card |
| `bot_ativo` | boolean | lido e alternado pelo botão "Assumir conversa" / "Devolver ao robô" |
| `temperatura` | text (`Frio`\|`Morno`\|`Quente`\|`Agendado`\|`NULL`) | define a coluna do card; gravado ao arrastar |
| `resumo_diario` | text (nullable) | trecho exibido no card |
| `updated_at` | timestamptz | usado pro "há quanto tempo" no card |

**`Interacoes`** (nome da tabela com "I" maiúsculo — identificador entre aspas no Postgres, `public."Interacoes"`)

| Coluna | Tipo | Uso nesta entrega |
|---|---|---|
| `lead_id` | uuid | filtro da consulta do histórico |
| `remetente` | text (`LEAD`\|`LOJA`\|`BOT`) | estilo visual da bolha de mensagem |
| `tipo` | text | tipo da mensagem original (texto/áudio/imagem) — exibido só como rótulo textual quando não for texto puro, sem tocar mídia |
| `conteudo` | text | corpo da mensagem |
| `created_at` | timestamptz | ordenação do histórico |

Nenhuma coluna nova, nenhuma migration — esta entrega só passa a ler e, no caso de `bot_ativo`/`temperatura`, escrever colunas que já existem.

## Arquitetura

- **Stack:** a mesma das telas anteriores, mais duas adições: `@dnd-kit/core` (já usado na reordenação de veículos, agora em modo "multiple containers" em vez de lista única) e o componente `sheet` do shadcn/ui (`npx shadcn add sheet`), ainda não instalado neste projeto.
- **Rota nova:** `/leads`, protegida por `ProtectedRoute`, com um link a partir do placeholder do Dashboard (mesmo padrão de "Ver veículos" / "Configurações da loja").
- **Novo módulo de dados:** `src/lib/leads.ts` — `getLeads(lojaId)`, `updateLeadTemperatura(leadId, temperatura)`, `getInteracoes(leadId)`, `setLeadBotAtivo(leadId, ativo)`.

## Board Kanban

Cinco colunas fixas, nesta ordem: **Novo** (`temperatura IS NULL`) → **Frio** → **Morno** → **Quente** → **Agendado**.

- `KanbanBoard.tsx` — recebe a lista de leads já carregada, agrupa por `temperatura` (mapeando `NULL` pra "Novo"), monta o `DndContext` com os sensores de mouse/toque/teclado do dnd-kit (mesmos sensores da reordenação de veículos).
- `KanbanColuna.tsx` — uma coluna droppable; cabeçalho com o nome da coluna e a contagem de leads.
- `LeadCard.tsx` — card individual, draggable: `nome`, `telefone`, primeira linha de `resumo_diario` (ou "Sem resumo ainda" quando `NULL`), um indicador visual de estado do bot (`bot_ativo` true/false), e o tempo relativo desde `updated_at` (ex.: "há 2h"). Clicar no card (fora da alça de arrastar) abre o painel lateral.

**Persistência ao soltar:** ao mover um card pra outra coluna, a UI atualiza otimisticamente e `updateLeadTemperatura(leadId, novaTemperatura)` é chamado em seguida — mesmo padrão já usado na reordenação de veículos (sem botão de salvar). Se a chamada falhar, o card volta pra coluna original e um erro inline aparece no topo do board. Mover um card pra dentro da coluna "Novo" não é permitido (não existe um valor de `temperatura` que represente "voltar a NULL"); a coluna "Novo" só recebe leads que já nascem lá — arrastar pra ela é bloqueado com um retorno visual imediato (o card volta pra coluna de origem, sem chamada ao Supabase).

**Estado vazio:** nenhum lead na loja ainda — o board mostra as 5 colunas vazias normalmente, sem mensagem especial (mesmo tratamento simples usado até aqui).

## Painel lateral (drawer)

Ao clicar num `LeadCard`, abre um `Sheet` (shadcn) pela direita, sem sair do board:

- Cabeçalho: nome e telefone do lead.
- Corpo: histórico de `Interacoes` daquele lead, ordenado por `created_at` crescente, renderizado como bolhas de mensagem — alinhadas à direita e com destaque visual pra `LOJA`/`BOT` (quem "fala pela loja"), à esquerda pra `LEAD`. Mensagens com `tipo` diferente de texto mostram um rótulo (ex.: "🎤 Áudio", "🖼️ Imagem") em vez do `conteudo` bruto.
- Rodapé: botão que alterna conforme `bot_ativo` atual — "Assumir conversa" (grava `bot_ativo = false`) quando `true`; "Devolver ao robô" (grava `bot_ativo = true`) quando `false`. Ação otimista, com reversão e erro inline em caso de falha (mesmo padrão do restante do painel).

Fechar o `Sheet` não recarrega o board.

## Componentes

- `src/lib/leads.ts` (novo) — funções de dados descritas em "Arquitetura".
- `src/pages/Leads.tsx` (novo) — resolve `loja_id` via `useLoja`, carrega os leads, orquestra o board e o estado de qual lead está aberto no painel lateral.
- `src/components/leads/KanbanBoard.tsx` (novo).
- `src/components/leads/KanbanColuna.tsx` (novo).
- `src/components/leads/LeadCard.tsx` (novo).
- `src/components/leads/PainelConversaLead.tsx` (novo) — o `Sheet` com histórico e o botão de assumir/devolver; recebe o lead selecionado e busca as `Interacoes` daquele lead ao abrir.
- `src/App.tsx` — nova rota `/leads`.
- `src/pages/Dashboard.tsx` — novo link "CRM".

## Testes

TDD, como no resto do projeto (Vitest + React Testing Library):

- `leads.test.ts` — `getLeads`, `updateLeadTemperatura`, `getInteracoes`, `setLeadBotAtivo`: parâmetros corretos passados ao client do Supabase, e propagação de erro.
- `KanbanBoard.test.tsx` — agrupamento correto dos leads nas 5 colunas (incluindo `temperatura IS NULL` → "Novo"); simulando o sensor de teclado do dnd-kit (mesma técnica da reordenação de veículos), confirma que mover um card entre colunas chama o callback de atualização com a `temperatura` esperada, e que mover um card para "Novo" é bloqueado (callback não é chamado).
- `PainelConversaLead.test.tsx` — renderiza o histórico na ordem certa, diferencia visualmente `LEAD`/`LOJA`/`BOT`, mostra o rótulo correto pra mensagens não-texto, e alterna o botão conforme `bot_ativo` (incluindo o caso de falha ao gravar, com reversão e erro inline).
- `Leads.test.tsx` — integra board + painel lateral: abrir um card mostra o histórico daquele lead; fechar não recarrega o board.

## Decisões e pendências

- **Reclassificação manual sobrescrita pelo resumo noturno:** aceito como comportamento esperado (ver "Fora de escopo"). Se isso incomodar na prática, um sub-projeto futuro pode adicionar uma flag de "classificação manual" que o `ZapCar - ResumoLeadsDiario` respeite — fora do escopo aqui.
- **dnd-kit em modo múltiplas colunas:** diferente do uso anterior (lista única, reordenação de veículos); usa o padrão de "multiple containers" da própria biblioteca, mas mantém a mesma decisão já registrada no projeto (dnd-kit em vez de HTML5 nativo, por causa do suporte a toque e teclado).
- **Sem migration:** todas as colunas usadas já existem e já são mantidas pelos workflows n8n.

## Próximos sub-projetos (fora de escopo aqui, só pra contexto)

1. Fundação ✅
2. CRUD de veículos ✅
3. Vitrine pública com CTA de WhatsApp, dividido em:
   - 3a. Configurações da loja ✅
   - 3b. Reordenação manual dos veículos ✅
   - 3c. Vitrine pública (`/v/:slug`) ✅
4. Dashboard CRM (este documento).
5. Billing (Stripe) + landing page.
