# ZapCar — Painel do Lojista (Front-end)

## O que é

SaaS B2B multi-tenant para revendas de veículos seminovos. Este repositório é o **front-end** (painel do lojista) — React 18 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + React Router + Supabase Auth.

O back-end (Supabase: schema/RLS/triggers; n8n: agente de atendimento via WhatsApp) vive fora deste repositório e já está em produção, homologado e com uma correção de segurança de isolamento multi-tenant aplicada (ver histórico da conversa que criou este projeto, ou o arquivo de spec abaixo para o contexto resumido).

## Estado atual

O sub-projeto **"Fundação"** está completo e no ar:
- Cadastro/login funcionando (Supabase Auth), rota protegida, dashboard placeholder, deploy automático.
- URL de produção: `https://zapcar-frontend.vercel.app`
- Repositório: `https://github.com/johnpmatias/zapcar-frontend` (branch `main`)
- Deploy: Vercel, auto-deploy a cada push em `main`.

Spec: `docs/superpowers/specs/2026-09-13-fundacao-painel-design.md`
Plano de implementação (executado, 8 tasks + revisão final, todas completas): `docs/superpowers/plans/2026-09-13-fundacao-painel.md`

Spec do CRUD de veículos: `docs/superpowers/specs/2026-09-13-crud-veiculos-design.md`
Plano de implementação do CRUD de veículos: `docs/superpowers/plans/2026-09-13-crud-veiculos.md`

Spec de Configurações da loja: `docs/superpowers/specs/2026-09-14-configuracoes-loja-design.md`

## Roteiro — próximos sub-projetos (nesta ordem)

1. ~~Fundação~~ ✅ completo
2. ~~CRUD de veículos~~ ✅ completo
3. **Vitrine pública com CTA de WhatsApp** (`/v/:slug`) — dividido em três sub-projetos menores, cada um com spec+plano+implementação próprios:
   - 3a. **Configurações da loja** — próximo. Tela `/configuracoes` para editar todos os dados cadastrais da loja (identidade, endereço, horários, aparência, textos/imagem da vitrine, SEO, redes sociais, tracking).
   - 3b. Reordenação manual dos veículos (`ordem`) — drag-and-drop em `/veiculos`, adiada do CRUD de veículos.
   - 3c. Vitrine pública (`/v/:slug`) propriamente dita — consome os dados de 3a e a ordem de 3b, com CTA de WhatsApp por veículo.
4. Dashboard CRM (histórico de conversa, temperatura do lead, assumir conversa manualmente).
5. Billing (Stripe) + landing page.

Cada sub-projeto segue o mesmo ciclo: brainstorming (spec) → writing-plans (plano) → subagent-driven-development (execução) → finishing-a-development-branch (merge).

## Convenções deste projeto

- **Sem apego a "React 18" no nome** — o scaffold real instalou React 19.3.0 (o shadcn/Vite mudaram desde que a spec original foi escrita). Funciona normalmente, é só uma imprecisão de nomenclatura na spec original.
- **Testes:** a Fundação usa verificação manual (checklist), não testes automatizados — decisão registrada na spec por não haver lógica de negócio própria ainda. A partir do CRUD de veículos (que já tem lógica real: validação, regras de estoque), passar a usar TDD.
- **Variáveis de ambiente:** `.env.local` (nunca commitado) precisa de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` — **sempre a publishable key** (`sb_publishable_...`), nunca a secret key (`sb_secret_...`). Um erro nisso já custou bastante tempo de depuração numa sessão anterior — ver `README.md` para instruções completas de setup.
- **Commits:** toda mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **shadcn/ui:** este projeto usa a versão atual do CLI shadcn, que instala com `style: "base-nova"` sobre primitivas `@base-ui/react` (não Radix) e o pacote `cn` (não `clsx`+`tailwind-merge`) — diferente do que specs antigas possam supor. A API pública dos componentes (`variant`, `size`, etc) é compatível com o padrão shadcn usual.
- **`src/hooks/useAuth.ts`** é onde vive o hook (não em `AuthContext.tsx`, que exporta só o componente `AuthProvider` — separação feita pra evitar um aviso de Fast Refresh do oxlint). O objeto de contexto em si fica em `src/contexts/auth-context.ts`.

## Sobre o usuário (preferências de colaboração)

Analista de sistemas, não programa profissionalmente há mais de 12 anos mas entende bem lógica de programação. É autista e tem TDAH — precisa de previsibilidade maior que a média e a motivação para o projeto oscila. Por isso: trabalhar em pedaços pequenos e bem definidos, cada um terminando em algo visível/testável, em vez de um esforço grande e aberto. Manter specs e planos escritos e versionados como âncora externa pra retomar contexto depois de uma pausa.

## Pendência conhecida (não bloqueante)

O trigger `handle_new_user` cria lojas novas com `vitrine_publica = true` por padrão (deveria ser `false` até o lojista ativar de propósito). Não é urgente (loja nova nasce sem `slug`, então não é alcançável publicamente), mas vale rodar antes de começar o sub-projeto da Vitrine Pública:

```sql
alter table public.lojas alter column vitrine_publica set default false;
```

## Back-end (referência rápida, fora deste repo)

- Supabase: schema com `lojas`, `leads`, `veiculos`, `agendamentos`, `Interacoes`, `lojas_config_whatsapp`, `lojas_config_ia`, `user_roles`. RLS por `loja_id`/`auth.uid()`. Trigger `handle_new_user` cria `lojas` + `user_roles` + `lojas_config_ia` automaticamente no cadastro (corrigido nesta sessão — antes só criava `lojas`).
- n8n: 3 workflows (`ZapCar - Gerador de QR Code`, `ZapCar - AgenteAtendimento`, `ZapCar - ResumoLeadsDiario`), já corrigidos pra usar `service_role` nas tools da IA em vez de anon key hardcoded.
- WhatsApp: hoje via Evolution API (não-oficial). Plano combinado: manter pra validar rápido, migrar pra API Oficial do WhatsApp assim que houver o primeiro cliente pagante de verdade (não familiar/conhecido) — ver detalhes na conversa original se precisar retomar essa decisão.
