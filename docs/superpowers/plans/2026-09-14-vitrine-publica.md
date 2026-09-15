# Vitrine Pública Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a qualquer visitante, sem login, uma vitrine pública em `/v/:slug` com a identidade visual da loja e a grade de veículos disponíveis/reservados (na ordem definida em 3b), cada um com um botão que abre uma conversa de WhatsApp já preenchida sobre aquele veículo — última entrega do item 3 do roteiro (Vitrine pública com CTA de WhatsApp).

**Architecture:** Camada de dados fina e somente-leitura sobre o Supabase (`src/lib/vitrine.ts`), consumida por um hook (`useVitrine`) e uma página (`Vitrine.tsx`) fora da área autenticada. Um card de veículo (`CardVeiculo`) monta o link de WhatsApp por unidade (`src/lib/whatsapp.ts`). Scripts de tracking (Meta Pixel/Google Tag) são injetados via um helper isolado (`src/lib/tracking.ts`). O toggle `vitrine_publica`, deixado de fora do 3a de propósito, volta ao formulário de Configurações. Uma serverless function (`api/vitrine-preview.ts`), roteada só para bots de preview via `vercel.json`, resolve o problema de tags `<meta>` de OG/SEO não serem lidas por bots que não executam JavaScript.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (`base-nova`) + React Router 7 + `@supabase/supabase-js` + `@vercel/node` + Vitest + React Testing Library. Nenhuma biblioteca nova.

**Spec:** `docs/superpowers/specs/2026-09-14-vitrine-publica-design.md`

## Global Constraints

- Usar sempre a chave **publishable** do Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY`), nunca a `secret key`.
- TDD em todo arquivo de lógica e componente: teste escrito e falhando antes da implementação.
- **Zod instalado é v4**: `.default(false)` em `z.coerce.boolean()` já é o padrão usado em `veiculo-schema.ts` (`aceita_troca`, `destaque`) — seguir o mesmo padrão pro campo `vitrine_publica` novo.
- **shadcn `Button` deste projeto não tem prop `asChild`** (primitivas `@base-ui/react`) — usar a prop `render` quando precisar envolver um `<a>`/`Link` (ver `CardVeiculo` e `Vitrine.tsx` nas Tasks 5 e 6).
- **shadcn `Switch` deste projeto** é controlado via `checked`/`onCheckedChange` (ver `aceita_troca`/`destaque` em `VeiculoForm.tsx`) — mesmo padrão pro switch `vitrine_publica` na Task 4.
- Toda mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **RLS já pronta em produção, nenhuma migration necessária:** confirmado via `pg_policies` — `lojas` tem a policy `"vitrine publica leitura anonima"` (`SELECT` pra `anon`/`authenticated` quando `vitrine_publica = true`) e `veiculos` tem `"Vitrine pública lê veículos"` (`SELECT` quando `status` está em `disponivel`/`reservado`/`ativo` e a loja tem `vitrine_publica = true`).
- **Pendência de back-end, rodar antes da Task 4 (ou antes de qualquer teste manual):** o trigger `handle_new_user` cria lojas novas com `vitrine_publica = true` por padrão (deveria ser `false` até o lojista ativar de propósito). Rodar no SQL Editor do Supabase:

```sql
alter table public.lojas alter column vitrine_publica set default false;
```

- **Nenhuma env var nova** pra `api/vitrine-preview.ts`: a function lê `process.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, já configuradas na Vercel — o prefixo `VITE_` só controla o que o Vite embute no bundle do navegador; uma serverless function lê `process.env` normalmente, sem esse filtro.
- **Número de WhatsApp:** `lojas.telefone_contato`, não `lojas_config_whatsapp` (tabela só de conexão da Evolution API — `instance_name`/`qrcode`/`status`, sem número e sem leitura anônima liberada).

---

## Task 1: Normalização de número e link de WhatsApp (`whatsapp.ts`)

**Files:**
- Create: `src/lib/whatsapp.ts`
- Create: `src/lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `formatarNumeroWhatsapp(telefone: string | null | undefined): string | null`, `montarLinkWhatsapp(numero: string, mensagem: string): string` — usadas por `CardVeiculo` (Task 5) e `Vitrine.tsx` (Task 6).

- [ ] **Step 1: Escrever os testes (falhando)**

`src/lib/whatsapp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatarNumeroWhatsapp, montarLinkWhatsapp } from '@/lib/whatsapp'

describe('formatarNumeroWhatsapp', () => {
  it('remove máscara e prefixa o DDI quando o número não tem DDI (celular, 11 dígitos)', () => {
    expect(formatarNumeroWhatsapp('(11) 99999-8888')).toBe('5511999998888')
  })

  it('remove máscara e prefixa o DDI quando o número não tem DDI (fixo, 10 dígitos)', () => {
    expect(formatarNumeroWhatsapp('(11) 9999-8888')).toBe('551199998888')
  })

  it('mantém o número como está quando já vem com DDI', () => {
    expect(formatarNumeroWhatsapp('5511999998888')).toBe('5511999998888')
  })

  it('retorna null para número vazio', () => {
    expect(formatarNumeroWhatsapp('')).toBeNull()
  })

  it('retorna null para null ou undefined', () => {
    expect(formatarNumeroWhatsapp(null)).toBeNull()
    expect(formatarNumeroWhatsapp(undefined)).toBeNull()
  })

  it('retorna null quando não sobram dígitos suficientes', () => {
    expect(formatarNumeroWhatsapp('99998888')).toBeNull()
  })

  it('retorna null quando sobram dígitos demais', () => {
    expect(formatarNumeroWhatsapp('551199999888899')).toBeNull()
  })
})

describe('montarLinkWhatsapp', () => {
  it('monta o link wa.me com a mensagem codificada', () => {
    const mensagem = 'Olá! Vi o anúncio do Onix 2022.'
    const link = montarLinkWhatsapp('5511999998888', mensagem)
    expect(link).toBe(`https://wa.me/5511999998888?text=${encodeURIComponent(mensagem)}`)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- whatsapp.test`
Expected: FAIL com erro de módulo `@/lib/whatsapp` não encontrado

- [ ] **Step 3: Implementar**

`src/lib/whatsapp.ts`:

```ts
export function formatarNumeroWhatsapp(telefone: string | null | undefined): string | null {
  if (!telefone) return null

  let digitos = telefone.replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) {
    digitos = `55${digitos}`
  }

  if (digitos.length < 12 || digitos.length > 13) return null
  return digitos
}

export function montarLinkWhatsapp(numero: string, mensagem: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- whatsapp.test`
Expected: PASS (8 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp.ts src/lib/whatsapp.test.ts
git commit -m "feat: normalização de número e montagem de link de WhatsApp

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Camada de dados públicos (`vitrine.ts`)

**Files:**
- Create: `src/lib/vitrine.ts`
- Create: `src/lib/vitrine.test.ts`

**Interfaces:**
- Consumes: `type Loja` (de `@/lib/loja`, já existente), `type Veiculo` (de `@/lib/veiculos`, já existente), `supabase` (de `@/lib/supabase`, mockado no teste).
- Produces: `type LojaPublica`, `getLojaPublica(slug: string): Promise<LojaPublica | null>`, `listVeiculosPublicos(lojaId: string): Promise<Veiculo[]>` — usadas por `useVitrine` (Task 6) e pelos testes da página (Task 6).

- [ ] **Step 1: Escrever os testes com o client do Supabase mockado**

`src/lib/vitrine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { getLojaPublica, listVeiculosPublicos } from '@/lib/vitrine'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(supabase.from).mockReset()
})

describe('getLojaPublica', () => {
  it('busca a loja pelo slug, só quando a vitrine está pública', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'loja-1', nome_loja: 'Auto Center Silva' }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getLojaPublica('auto-center-silva')

    expect(supabase.from).toHaveBeenCalledWith('lojas')
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'slug', 'auto-center-silva')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'vitrine_publica', true)
    expect(resultado?.id).toBe('loja-1')
  })

  it('retorna null quando não encontra (slug inexistente ou vitrine desativada)', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    expect(await getLojaPublica('inexistente')).toBeNull()
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(getLojaPublica('auto-center-silva')).rejects.toThrow('falha de rede')
  })
})

describe('listVeiculosPublicos', () => {
  it('busca os veículos da loja ordenados pela ordem manual', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    builder.order.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: [{ id: 'v1' }],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await listVeiculosPublicos('loja-1')

    expect(supabase.from).toHaveBeenCalledWith('veiculos')
    expect(builder.eq).toHaveBeenCalledWith('loja_id', 'loja-1')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'ordem', { ascending: true })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false })
    expect(resultado).toHaveLength(1)
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    builder.order.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: null,
      error: { message: 'falha de rede' },
    })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(listVeiculosPublicos('loja-1')).rejects.toThrow('falha de rede')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- vitrine.test`
Expected: FAIL com erro de módulo `@/lib/vitrine` não encontrado

- [ ] **Step 3: Implementar**

`src/lib/vitrine.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { Loja } from '@/lib/loja'
import type { Veiculo } from '@/lib/veiculos'

export type LojaPublica = Pick<
  Loja,
  | 'id'
  | 'nome_loja'
  | 'descricao'
  | 'telefone_contato'
  | 'logradouro'
  | 'numero'
  | 'bairro'
  | 'cidade'
  | 'estado'
  | 'cep'
  | 'google_maps_link'
  | 'horario_semana_abertura'
  | 'horario_semana_fechamento'
  | 'horario_sabado_abertura'
  | 'horario_sabado_fechamento'
  | 'horario_domingo_abertura'
  | 'horario_domingo_fechamento'
  | 'logo_url'
  | 'banner_url'
  | 'cor_primaria'
  | 'cor_secundaria'
  | 'vitrine_headline'
  | 'vitrine_subheadline'
  | 'vitrine_cta_texto'
  | 'vitrine_cta_destino'
  | 'vitrine_destaque_url'
  | 'meta_titulo'
  | 'meta_descricao'
  | 'og_image_url'
  | 'instagram_url'
  | 'facebook_url'
  | 'tiktok_url'
  | 'youtube_url'
  | 'meta_pixel_id'
  | 'google_tag_id'
>

const COLUNAS_LOJA_PUBLICA =
  'id,nome_loja,descricao,telefone_contato,logradouro,numero,bairro,cidade,estado,cep,google_maps_link,' +
  'horario_semana_abertura,horario_semana_fechamento,horario_sabado_abertura,horario_sabado_fechamento,' +
  'horario_domingo_abertura,horario_domingo_fechamento,logo_url,banner_url,cor_primaria,cor_secundaria,' +
  'vitrine_headline,vitrine_subheadline,vitrine_cta_texto,vitrine_cta_destino,vitrine_destaque_url,' +
  'meta_titulo,meta_descricao,og_image_url,instagram_url,facebook_url,tiktok_url,youtube_url,meta_pixel_id,google_tag_id'

export async function getLojaPublica(slug: string): Promise<LojaPublica | null> {
  const { data, error } = await supabase
    .from('lojas')
    .select(COLUNAS_LOJA_PUBLICA)
    .eq('slug', slug)
    .eq('vitrine_publica', true)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as LojaPublica | null) ?? null
}

export async function listVeiculosPublicos(lojaId: string): Promise<Veiculo[]> {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .eq('loja_id', lojaId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Veiculo[]
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- vitrine.test`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vitrine.ts src/lib/vitrine.test.ts
git commit -m "feat: camada de dados públicos da loja e dos veículos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Injeção de scripts de tracking (`tracking.ts`)

**Files:**
- Create: `src/lib/tracking.ts`
- Create: `src/lib/tracking.test.ts`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `injetarMetaPixel(pixelId: string): () => void`, `injetarGoogleTag(tagId: string): () => void` — usadas por `Vitrine.tsx` (Task 6), uma por `useEffect`, retornando a função de limpeza.

- [ ] **Step 1: Escrever os testes (falhando)**

`src/lib/tracking.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { injetarMetaPixel, injetarGoogleTag } from '@/lib/tracking'

afterEach(() => {
  document.head.innerHTML = ''
})

describe('injetarMetaPixel', () => {
  it('injeta o script do Meta Pixel com o id da loja', () => {
    injetarMetaPixel('123456789')

    const script = document.getElementById('zapcar-meta-pixel')
    expect(script).not.toBeNull()
    expect(script?.innerHTML).toContain("fbq('init','123456789')")
  })

  it('remove o script quando a função de limpeza é chamada', () => {
    const remover = injetarMetaPixel('123456789')
    remover()

    expect(document.getElementById('zapcar-meta-pixel')).toBeNull()
  })

  it('não injeta duas vezes se o script já existir', () => {
    injetarMetaPixel('123456789')
    injetarMetaPixel('123456789')

    expect(document.querySelectorAll('#zapcar-meta-pixel')).toHaveLength(1)
  })
})

describe('injetarGoogleTag', () => {
  it('injeta os dois scripts do Google Tag com o id da loja', () => {
    injetarGoogleTag('G-ABC123')

    const scriptExterno = document.getElementById('zapcar-google-tag-lib') as HTMLScriptElement | null
    const scriptConfig = document.getElementById('zapcar-google-tag-config')
    expect(scriptExterno?.src).toContain('G-ABC123')
    expect(scriptConfig?.innerHTML).toContain("gtag('config','G-ABC123')")
  })

  it('remove os dois scripts quando a função de limpeza é chamada', () => {
    const remover = injetarGoogleTag('G-ABC123')
    remover()

    expect(document.getElementById('zapcar-google-tag-lib')).toBeNull()
    expect(document.getElementById('zapcar-google-tag-config')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tracking.test`
Expected: FAIL com erro de módulo `@/lib/tracking` não encontrado

- [ ] **Step 3: Implementar**

`src/lib/tracking.ts`:

```ts
export function injetarMetaPixel(pixelId: string): () => void {
  const id = 'zapcar-meta-pixel'
  if (document.getElementById(id)) return () => {}

  const script = document.createElement('script')
  script.id = id
  script.innerHTML =
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?` +
    `n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;` +
    `n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;` +
    `t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,` +
    `document,'script','https://connect.facebook.net/en_US/fbevents.js');` +
    `fbq('init','${pixelId}');fbq('track','PageView');`

  document.head.appendChild(script)
  return () => script.remove()
}

export function injetarGoogleTag(tagId: string): () => void {
  const idLib = 'zapcar-google-tag-lib'
  const idConfig = 'zapcar-google-tag-config'
  if (document.getElementById(idConfig)) return () => {}

  const scriptLib = document.createElement('script')
  scriptLib.id = idLib
  scriptLib.async = true
  scriptLib.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`
  document.head.appendChild(scriptLib)

  const scriptConfig = document.createElement('script')
  scriptConfig.id = idConfig
  scriptConfig.innerHTML =
    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
    `gtag('js',new Date());gtag('config','${tagId}');`
  document.head.appendChild(scriptConfig)

  return () => {
    scriptLib.remove()
    scriptConfig.remove()
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- tracking.test`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracking.ts src/lib/tracking.test.ts
git commit -m "feat: injeção de scripts de tracking (Meta Pixel / Google Tag)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Toggle `vitrine_publica` de volta às Configurações

**Files:**
- Modify: `src/lib/loja-schema.ts`
- Modify: `src/lib/loja-schema.test.ts`
- Modify: `src/lib/loja.ts`
- Modify: `src/lib/loja.test.ts`
- Modify: `src/pages/Configuracoes.tsx`
- Modify: `src/pages/Configuracoes.test.tsx`

**Interfaces:**
- Consumes: nenhuma nova.
- Produces: `lojaSchema` passa a incluir `vitrine_publica: boolean`; `LojaPayload` passa a incluir `vitrine_publica` (deixa de ser omitido).

**Antes de testar manualmente esta task**, rode a SQL do `Global Constraints` (`alter table public.lojas alter column vitrine_publica set default false;`) no SQL Editor do Supabase.

- [ ] **Step 1: Escrever os testes do schema (falhando)**

Em `src/lib/loja-schema.test.ts`, adicionar estes dois testes dentro do `describe('lojaSchema', ...)` já existente:

```ts
  it('vitrine_publica tem valor padrão falso quando omitido', () => {
    const resultado = lojaSchema.safeParse(dadosMinimos)
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.vitrine_publica).toBe(false)
    }
  })

  it('aceita vitrine_publica true', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, vitrine_publica: true })
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.vitrine_publica).toBe(true)
    }
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- loja-schema`
Expected: FAIL — `resultado.data.vitrine_publica` é `undefined`, não `false`/`true` (o campo ainda não existe no schema)

- [ ] **Step 3: Adicionar o campo ao schema**

Em `src/lib/loja-schema.ts`, dentro de `lojaSchema`, adicionar logo depois de `slug: slugOpcional(),`:

```ts
  vitrine_publica: z.coerce.boolean().default(false),
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- loja-schema`
Expected: PASS (14 testes)

- [ ] **Step 5: Escrever o teste da camada de dados (falhando)**

Em `src/lib/loja.test.ts`, adicionar `vitrine_publica: false,` ao objeto `payloadExemplo` (qualquer posição, ex.: logo depois de `slug: null,`). O TypeScript vai reclamar até o `LojaPayload` ser atualizado no Step 6 — é esperado.

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npx tsc -b`
Expected: erro de tipo — `payloadExemplo` tem uma propriedade `vitrine_publica` que `LojaPayload` não aceita (ele ainda é omitido)

- [ ] **Step 7: Incluir `vitrine_publica` no payload**

Em `src/lib/loja.ts`, trocar:

```ts
export type LojaPayload = Omit<Loja, 'id' | 'user_id' | 'vitrine_publica' | 'created_at'>
```

por:

```ts
export type LojaPayload = Omit<Loja, 'id' | 'user_id' | 'created_at'>
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `npx tsc -b && npm test -- loja.test`
Expected: sem erros de tipo; PASS (5 testes)

- [ ] **Step 9: Escrever os testes da UI (falhando)**

Em `src/pages/Configuracoes.test.tsx`, adicionar estes dois testes dentro do `describe('ConfiguracoesPage', ...)` já existente:

```tsx
  it('mostra o switch de vitrine pública desabilitado quando não há slug', async () => {
    vi.mocked(getLoja).mockResolvedValue({ ...lojaExemplo, slug: null } as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))

    expect(screen.getByRole('switch', { name: /vitrine pública ativa/i })).toBeDisabled()
    expect(screen.getByText(/defina um endereço antes de ativar/i)).toBeInTheDocument()
  })

  it('ativa e salva a vitrine pública quando há slug', async () => {
    vi.mocked(getLoja).mockResolvedValue({ ...lojaExemplo, slug: 'auto-center-silva' } as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))
    await usuario.click(screen.getByRole('switch', { name: /vitrine pública ativa/i }))
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith('user-1', expect.objectContaining({ vitrine_publica: true }))
  })
```

- [ ] **Step 10: Rodar e confirmar que falha**

Run: `npm test -- Configuracoes.test`
Expected: FAIL — não existe nenhum elemento com `role="switch"` e nome "Vitrine pública ativa"

- [ ] **Step 11: Implementar a UI**

Em `src/pages/Configuracoes.tsx`:

1. Adicionar o import do `Switch`, junto aos outros imports de componentes:

```tsx
import { Switch } from '@/components/ui/switch'
```

2. Em `valoresIniciais`, adicionar `vitrine_publica: false,` (ele é `boolean`, não texto — não segue o padrão `undefined` dos outros campos opcionais).

3. Dentro do `useLayoutEffect` que chama `form.reset(...)`, adicionar `vitrine_publica: loja.vitrine_publica ?? false,` ao objeto passado pro `reset`.

4. Dentro de `onSubmit`, no objeto `payload: LojaPayload`, adicionar `vitrine_publica: valores.vitrine_publica,`.

5. Na `<TabsContent value="vitrine" ...>`, adicionar este bloco como o **primeiro filho**, antes da `<div>` do campo `slug`:

```tsx
                <div className="flex items-center gap-2">
                  <Switch
                    id="vitrine_publica"
                    checked={Boolean(form.watch('vitrine_publica'))}
                    onCheckedChange={(v) => form.setValue('vitrine_publica', v)}
                    disabled={!form.watch('slug')}
                  />
                  <Label htmlFor="vitrine_publica">Vitrine pública ativa</Label>
                </div>
                {!form.watch('slug') && (
                  <p className="text-sm text-muted-foreground">Defina um endereço antes de ativar.</p>
                )}
```

- [ ] **Step 12: Rodar e confirmar que passa**

Run: `npm test -- Configuracoes.test`
Expected: PASS (17 testes)

- [ ] **Step 13: Verificação manual**

Run: `npm run dev`, acessar `/configuracoes`, aba "Vitrine". Confirmar que o switch está desabilitado sem um `slug` preenchido, que preencher o `slug` habilita o switch, e que ligar + salvar grava `vitrine_publica = true` na tabela `lojas` (confirmar no Table Editor do Supabase).

- [ ] **Step 14: Commit**

```bash
git add src/lib/loja-schema.ts src/lib/loja-schema.test.ts src/lib/loja.ts src/lib/loja.test.ts src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: switch de vitrine pública ativa em Configurações

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Componente `CardVeiculo`

**Files:**
- Create: `src/components/vitrine/CardVeiculo.tsx`
- Create: `src/components/vitrine/CardVeiculo.test.tsx`

**Interfaces:**
- Consumes: `type Veiculo` (de `@/lib/veiculos`, já existente); `montarLinkWhatsapp` (Task 1).
- Produces: `CardVeiculo` — props `{ veiculo: Veiculo; numeroWhatsapp: string | null }`. Usado por `Vitrine.tsx` (Task 6).

- [ ] **Step 1: Escrever os testes (falhando)**

`src/components/vitrine/CardVeiculo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CardVeiculo } from './CardVeiculo'
import type { Veiculo } from '@/lib/veiculos'

const veiculoBase: Veiculo = {
  id: '1',
  loja_id: 'loja-1',
  marca: 'Chevrolet',
  modelo: 'Onix',
  versao: '1.0 Turbo',
  ano_fabricacao: 2022,
  ano_modelo: 2022,
  cor: null,
  km: 42000,
  combustivel: null,
  cambio: null,
  carroceria: null,
  portas: null,
  placa: null,
  placa_final: null,
  preco: 62900,
  preco_promocional: null,
  aceita_troca: false,
  destaque: false,
  descricao: null,
  opcionais: [],
  status: 'disponivel',
  fotos: ['https://exemplo.com/foto1.jpg'],
  foto_capa: null,
  titulo: 'Chevrolet Onix 1.0 Turbo',
  ordem: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('CardVeiculo', () => {
  it('mostra os dados principais do veículo', () => {
    render(<CardVeiculo veiculo={veiculoBase} numeroWhatsapp="5511999998888" />)

    expect(screen.getByText('Chevrolet Onix 1.0 Turbo')).toBeInTheDocument()
    expect(screen.getByText(/42\.000 km/)).toBeInTheDocument()
    expect(screen.getByText('R$ 62.900,00')).toBeInTheDocument()
  })

  it('risca o preço original e mostra o promocional quando houver', () => {
    render(
      <CardVeiculo veiculo={{ ...veiculoBase, preco_promocional: 59900 }} numeroWhatsapp="5511999998888" />
    )

    expect(screen.getByText('R$ 62.900,00')).toHaveClass('line-through')
    expect(screen.getByText('R$ 59.900,00')).toBeInTheDocument()
  })

  it('mostra o badge "Reservado" quando o status é reservado', () => {
    render(<CardVeiculo veiculo={{ ...veiculoBase, status: 'reservado' }} numeroWhatsapp="5511999998888" />)

    expect(screen.getByText('Reservado')).toBeInTheDocument()
  })

  it('não mostra o badge quando o status é disponível', () => {
    render(<CardVeiculo veiculo={veiculoBase} numeroWhatsapp="5511999998888" />)

    expect(screen.queryByText('Reservado')).not.toBeInTheDocument()
  })

  it('monta o link de WhatsApp com a mensagem do veículo', () => {
    render(<CardVeiculo veiculo={veiculoBase} numeroWhatsapp="5511999998888" />)

    const link = screen.getByRole('link', { name: /falar no whatsapp/i })
    const mensagem = 'Olá! Vi o anúncio do Chevrolet Onix 2022 na vitrine e gostaria de mais informações.'
    expect(link.getAttribute('href')).toBe(`https://wa.me/5511999998888?text=${encodeURIComponent(mensagem)}`)
  })

  it('esconde o botão de WhatsApp quando não há número válido', () => {
    render(<CardVeiculo veiculo={veiculoBase} numeroWhatsapp={null} />)

    expect(screen.queryByRole('link', { name: /falar no whatsapp/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- CardVeiculo.test`
Expected: FAIL com erro de módulo `./CardVeiculo` não encontrado

- [ ] **Step 3: Implementar**

`src/components/vitrine/CardVeiculo.tsx`:

```tsx
import type { Veiculo } from '@/lib/veiculos'
import { montarLinkWhatsapp } from '@/lib/whatsapp'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface CardVeiculoProps {
  veiculo: Veiculo
  numeroWhatsapp: string | null
}

function formatarPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CardVeiculo({ veiculo, numeroWhatsapp }: CardVeiculoProps) {
  const foto = veiculo.foto_capa ?? veiculo.fotos[0] ?? null
  const titulo = [veiculo.marca, veiculo.modelo, veiculo.versao].filter(Boolean).join(' ')
  const temPromocao = veiculo.preco_promocional != null && veiculo.preco_promocional < veiculo.preco

  const link = numeroWhatsapp
    ? montarLinkWhatsapp(
        numeroWhatsapp,
        `Olá! Vi o anúncio do ${veiculo.marca} ${veiculo.modelo} ${veiculo.ano_modelo} na vitrine e gostaria de mais informações.`
      )
    : null

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      {foto ? (
        <img src={foto} alt={titulo} className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 items-center justify-center bg-muted text-sm text-muted-foreground">
          Sem foto
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{titulo}</h3>
          {veiculo.status === 'reservado' && <Badge variant="secondary">Reservado</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {veiculo.ano_modelo}
          {veiculo.km != null ? ` · ${veiculo.km.toLocaleString('pt-BR')} km` : ''}
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          {temPromocao ? (
            <>
              <span className="text-xs text-muted-foreground line-through">{formatarPreco(veiculo.preco)}</span>
              <span className="text-sm font-bold">{formatarPreco(veiculo.preco_promocional as number)}</span>
            </>
          ) : (
            <span className="text-sm font-bold">{formatarPreco(veiculo.preco)}</span>
          )}
        </div>
        {link && (
          <Button className="mt-2" render={<a href={link} target="_blank" rel="noreferrer" />}>
            Falar no WhatsApp
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- CardVeiculo.test`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/components/vitrine/CardVeiculo.tsx src/components/vitrine/CardVeiculo.test.tsx
git commit -m "feat: card de veículo da vitrine pública com CTA de WhatsApp

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Hook `useVitrine` + página `Vitrine.tsx`, fim a fim

**Files:**
- Create: `src/hooks/useVitrine.ts`
- Create: `src/pages/Vitrine.tsx`
- Create: `src/pages/Vitrine.test.tsx`
- Modify: `src/App.tsx` (rota `/v/:slug`, fora de `ProtectedRoute`)

**Interfaces:**
- Consumes: `getLojaPublica`, `listVeiculosPublicos`, `type LojaPublica` (Task 2); `formatarNumeroWhatsapp`, `montarLinkWhatsapp` (Task 1); `injetarMetaPixel`, `injetarGoogleTag` (Task 3); `CardVeiculo` (Task 5).
- Produces: hook `useVitrine(slug: string)` retornando `{ loja: LojaPublica | null; veiculos: Veiculo[]; carregando: boolean; erro: string | null; recarregar: () => void }`; componente `VitrinePage` — a página final, demonstrável em `/v/:slug`.

- [ ] **Step 1: Escrever os testes da página (falhando)**

`src/pages/Vitrine.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import VitrinePage from '@/pages/Vitrine'
import { getLojaPublica, listVeiculosPublicos } from '@/lib/vitrine'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/vitrine', () => ({
  getLojaPublica: vi.fn(),
  listVeiculosPublicos: vi.fn(),
}))

const lojaExemplo = {
  id: 'loja-1',
  nome_loja: 'Auto Center Silva',
  descricao: null,
  telefone_contato: '11999998888',
  logradouro: null,
  numero: null,
  bairro: null,
  cidade: null,
  estado: null,
  cep: null,
  google_maps_link: null,
  horario_semana_abertura: null,
  horario_semana_fechamento: null,
  horario_sabado_abertura: null,
  horario_sabado_fechamento: null,
  horario_domingo_abertura: null,
  horario_domingo_fechamento: null,
  logo_url: null,
  banner_url: null,
  cor_primaria: null,
  cor_secundaria: null,
  vitrine_headline: 'Os melhores seminovos da região',
  vitrine_subheadline: null,
  vitrine_cta_texto: null,
  vitrine_cta_destino: null,
  vitrine_destaque_url: null,
  meta_titulo: null,
  meta_descricao: null,
  og_image_url: null,
  instagram_url: null,
  facebook_url: null,
  tiktok_url: null,
  youtube_url: null,
  meta_pixel_id: null,
  google_tag_id: null,
}

const veiculoExemplo = {
  id: 'v1',
  loja_id: 'loja-1',
  marca: 'Chevrolet',
  modelo: 'Onix',
  versao: null,
  ano_fabricacao: 2022,
  ano_modelo: 2022,
  cor: null,
  km: 42000,
  combustivel: null,
  cambio: null,
  carroceria: null,
  portas: null,
  placa: null,
  placa_final: null,
  preco: 62900,
  preco_promocional: null,
  aceita_troca: false,
  destaque: false,
  descricao: null,
  opcionais: [],
  status: 'disponivel',
  fotos: [],
  foto_capa: null,
  titulo: 'Chevrolet Onix',
  ordem: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.mocked(getLojaPublica).mockReset()
  vi.mocked(listVeiculosPublicos).mockReset()
  document.head.innerHTML = ''
})

function renderPagina(slug = 'auto-center-silva') {
  return render(
    <MemoryRouter initialEntries={[`/v/${slug}`]}>
      <Routes>
        <Route path="/v/:slug" element={<VitrinePage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('VitrinePage', () => {
  it('mostra estado de carregamento e depois a loja e os veículos', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue(lojaExemplo as never)
    vi.mocked(listVeiculosPublicos).mockResolvedValue([veiculoExemplo] as never)

    renderPagina()

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(await screen.findByText('Auto Center Silva')).toBeInTheDocument()
    expect(screen.getByText(/os melhores seminovos da região/i)).toBeInTheDocument()
    expect(screen.getByText('Chevrolet Onix')).toBeInTheDocument()
  })

  it('mostra "vitrine não encontrada" quando a loja não existe ou está desativada', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue(null)

    renderPagina('inexistente')

    expect(await screen.findByText(/vitrine não encontrada/i)).toBeInTheDocument()
    expect(listVeiculosPublicos).not.toHaveBeenCalled()
  })

  it('mostra mensagem de vazio quando a loja não tem veículos', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue(lojaExemplo as never)
    vi.mocked(listVeiculosPublicos).mockResolvedValue([])

    renderPagina()

    expect(await screen.findByText(/nenhum veículo disponível no momento/i)).toBeInTheDocument()
  })

  it('mostra erro com botão de tentar novamente quando falha ao carregar', async () => {
    vi.mocked(getLojaPublica).mockRejectedValue(new Error('falha de rede'))

    renderPagina()

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it('monta o link de WhatsApp do card com o número da loja', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue(lojaExemplo as never)
    vi.mocked(listVeiculosPublicos).mockResolvedValue([veiculoExemplo] as never)

    renderPagina()

    const link = await screen.findByRole('link', { name: /falar no whatsapp/i })
    expect(link.getAttribute('href')).toContain('https://wa.me/5511999998888')
  })

  it('injeta o script de tracking quando meta_pixel_id está preenchido', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue({ ...lojaExemplo, meta_pixel_id: '999' } as never)
    vi.mocked(listVeiculosPublicos).mockResolvedValue([])

    renderPagina()

    await screen.findByText('Auto Center Silva')
    expect(document.getElementById('zapcar-meta-pixel')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Vitrine.test`
Expected: FAIL com erro de módulo `@/pages/Vitrine` não encontrado

- [ ] **Step 3: Implementar o hook**

`src/hooks/useVitrine.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { getLojaPublica, listVeiculosPublicos, type LojaPublica } from '@/lib/vitrine'
import type { Veiculo } from '@/lib/veiculos'

interface EstadoVitrine {
  loja: LojaPublica | null
  veiculos: Veiculo[]
  carregando: boolean
  erro: string | null
}

const ESTADO_INICIAL: EstadoVitrine = { loja: null, veiculos: [], carregando: true, erro: null }

export function useVitrine(slug: string) {
  const [estado, setEstado] = useState<EstadoVitrine>(ESTADO_INICIAL)

  const carregar = useCallback(() => {
    setEstado({ loja: null, veiculos: [], carregando: true, erro: null })

    getLojaPublica(slug)
      .then(async (loja) => {
        if (!loja) {
          setEstado({ loja: null, veiculos: [], carregando: false, erro: null })
          return
        }
        const veiculos = await listVeiculosPublicos(loja.id)
        setEstado({ loja, veiculos, carregando: false, erro: null })
      })
      .catch((e: Error) => setEstado({ loja: null, veiculos: [], carregando: false, erro: e.message }))
  }, [slug])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { ...estado, recarregar: carregar }
}
```

- [ ] **Step 4: Implementar a página**

`src/pages/Vitrine.tsx`:

```tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useVitrine } from '@/hooks/useVitrine'
import { formatarNumeroWhatsapp, montarLinkWhatsapp } from '@/lib/whatsapp'
import { injetarGoogleTag, injetarMetaPixel } from '@/lib/tracking'
import { CardVeiculo } from '@/components/vitrine/CardVeiculo'
import { Button } from '@/components/ui/button'
import type { LojaPublica } from '@/lib/vitrine'

const DIAS_HORARIO: { abertura: keyof LojaPublica; fechamento: keyof LojaPublica; label: string }[] = [
  { abertura: 'horario_semana_abertura', fechamento: 'horario_semana_fechamento', label: 'Seg-sex' },
  { abertura: 'horario_sabado_abertura', fechamento: 'horario_sabado_fechamento', label: 'Sábado' },
  { abertura: 'horario_domingo_abertura', fechamento: 'horario_domingo_fechamento', label: 'Domingo' },
]

const REDES_SOCIAIS: { campo: keyof LojaPublica; label: string }[] = [
  { campo: 'instagram_url', label: 'Instagram' },
  { campo: 'facebook_url', label: 'Facebook' },
  { campo: 'tiktok_url', label: 'TikTok' },
  { campo: 'youtube_url', label: 'YouTube' },
]

function formatarHorario(loja: LojaPublica, dia: (typeof DIAS_HORARIO)[number]): string {
  const abertura = loja[dia.abertura] as string | null
  const fechamento = loja[dia.fechamento] as string | null
  if (!abertura || !fechamento) return `${dia.label}: Fechado`
  return `${dia.label}: ${abertura}–${fechamento}`
}

function temEndereco(loja: LojaPublica): boolean {
  return Boolean(loja.logradouro || loja.numero || loja.bairro || loja.cidade || loja.estado)
}

export default function VitrinePage() {
  const { slug } = useParams<{ slug: string }>()
  const { loja, veiculos, carregando, erro, recarregar } = useVitrine(slug ?? '')

  useEffect(() => {
    if (!loja?.meta_pixel_id) return
    return injetarMetaPixel(loja.meta_pixel_id)
  }, [loja?.meta_pixel_id])

  useEffect(() => {
    if (!loja?.google_tag_id) return
    return injetarGoogleTag(loja.google_tag_id)
  }, [loja?.google_tag_id])

  if (carregando) {
    return <p className="p-8 text-center text-muted-foreground">Carregando...</p>
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-2 p-8">
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
        <Button variant="outline" onClick={recarregar}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!loja) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Vitrine não encontrada.</p>
      </div>
    )
  }

  const numeroWhatsapp = formatarNumeroWhatsapp(loja.telefone_contato)
  const linkCtaGeral =
    loja.vitrine_cta_destino ||
    (numeroWhatsapp
      ? montarLinkWhatsapp(numeroWhatsapp, 'Olá! Vi a vitrine e gostaria de mais informações.')
      : null)

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="flex flex-col items-center gap-3 px-4 py-10 text-center text-white"
        style={{
          background: loja.banner_url
            ? `center / cover no-repeat url(${loja.banner_url})`
            : `linear-gradient(135deg, ${loja.cor_primaria ?? '#1e3a5f'}, ${loja.cor_secundaria ?? '#2d5f8a'})`,
        }}
      >
        {loja.logo_url && (
          <img src={loja.logo_url} alt={loja.nome_loja ?? ''} className="size-14 rounded-md object-cover" />
        )}
        <h1 className="text-2xl font-semibold">{loja.nome_loja}</h1>
        {loja.vitrine_headline && <p className="text-lg">{loja.vitrine_headline}</p>}
        {loja.vitrine_subheadline && <p className="text-sm opacity-90">{loja.vitrine_subheadline}</p>}
        {linkCtaGeral && (
          <Button render={<a href={linkCtaGeral} target="_blank" rel="noreferrer" />}>
            {loja.vitrine_cta_texto || 'Fale com a gente'}
          </Button>
        )}
      </header>

      <main className="flex-1 px-4 py-8">
        {veiculos.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Nenhum veículo disponível no momento. Fale com a gente!
          </p>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {veiculos.map((veiculo) => (
              <CardVeiculo key={veiculo.id} veiculo={veiculo} numeroWhatsapp={numeroWhatsapp} />
            ))}
          </div>
        )}
      </main>

      <footer className="flex flex-col items-center gap-2 border-t px-4 py-6 text-center text-sm text-muted-foreground">
        {temEndereco(loja) && (
          <p>
            {[loja.logradouro, loja.numero, loja.bairro, loja.cidade, loja.estado].filter(Boolean).join(', ')}
            {loja.google_maps_link && (
              <>
                {' · '}
                <a href={loja.google_maps_link} target="_blank" rel="noreferrer" className="underline">
                  Ver no mapa
                </a>
              </>
            )}
          </p>
        )}
        <div className="flex flex-col">
          {DIAS_HORARIO.map((dia) => (
            <span key={dia.label}>{formatarHorario(loja, dia)}</span>
          ))}
        </div>
        <div className="flex gap-3">
          {REDES_SOCIAIS.filter((rede) => loja[rede.campo]).map((rede) => (
            <a
              key={rede.campo}
              href={loja[rede.campo] as string}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {rede.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 5: Registrar a rota**

Em `src/App.tsx`, importar a página:

```tsx
import VitrinePage from '@/pages/Vitrine'
```

E adicionar a rota **fora** de `ProtectedRoute`, antes da rota catch-all (`path="*"`):

```tsx
      <Route path="/v/:slug" element={<VitrinePage />} />
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- Vitrine.test`
Expected: PASS (6 testes)

- [ ] **Step 7: Rodar a suíte inteira, o type-check e o lint**

Run: `npm test`
Expected: PASS (todos os arquivos)

Run: `npx tsc -b`
Expected: sem erros

Run: `npm run lint`
Expected: sem erros novos

- [ ] **Step 8: Verificação manual**

Pré-requisito: rodar a SQL do Global Constraints (`vitrine_publica` default `false`), ativar a vitrine de uma loja de teste em `/configuracoes` (Task 4) com pelo menos um veículo `disponivel` e um `reservado` cadastrados, com `telefone_contato` preenchido em formato brasileiro.

Run: `npm run dev`, acessar `/v/<slug-da-loja>` (sem estar logado, numa aba anônima). Confirmar que:
- o banner mostra nome, cores/logo e headline da loja;
- os veículos aparecem na grade, na mesma ordem definida em `/veiculos` (3b), com o veículo `reservado` mostrando o badge;
- o botão "Falar no WhatsApp" de um card abre o WhatsApp Web/app com o número e a mensagem certos;
- acessar `/v/slug-que-nao-existe` mostra "Vitrine não encontrada.";
- desativar a vitrine em `/configuracoes` faz `/v/<slug>` voltar a mostrar "Vitrine não encontrada.".

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useVitrine.ts src/pages/Vitrine.tsx src/pages/Vitrine.test.tsx src/App.tsx
git commit -m "feat: página pública da vitrine em /v/:slug

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Preview de link (OG) para bots — `api/vitrine-preview.ts`

**Files:**
- Create: `api/vitrine-preview.ts`
- Create: `api/vitrine-preview.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: nenhuma (function isolada, fala direto com a API REST do Supabase via `fetch`, sem importar `@/lib/*` — mesmo padrão de `api/consulta-placa.ts`).
- Produces: `ehBotDePreview(userAgent: string | undefined): boolean`, `buscarDadosPreview(slug, supabaseUrl, supabaseKey): Promise<DadosPreview | null>`, `montarHtmlPreview(dados: DadosPreview | null): string` — funções puras, testadas isoladamente. O `handler` (export default) as combina; segue o mesmo padrão de `api/consulta-placa.ts`, onde só a lógica pura é testada, não o wiring do `VercelRequest`/`VercelResponse`.

- [ ] **Step 1: Escrever os testes (falhando)**

`api/vitrine-preview.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ehBotDePreview, buscarDadosPreview, montarHtmlPreview } from './vitrine-preview.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('ehBotDePreview', () => {
  it('reconhece bots conhecidos de preview de link', () => {
    expect(ehBotDePreview('facebookexternalhit/1.1')).toBe(true)
    expect(ehBotDePreview('WhatsApp/2.23.20.0')).toBe(true)
    expect(ehBotDePreview('Twitterbot/1.0')).toBe(true)
  })

  it('não reconhece um navegador comum', () => {
    expect(ehBotDePreview('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(false)
  })

  it('retorna falso quando não há User-Agent', () => {
    expect(ehBotDePreview(undefined)).toBe(false)
  })
})

describe('buscarDadosPreview', () => {
  it('retorna os dados da loja quando encontrada', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          nome_loja: 'Auto Center Silva',
          vitrine_headline: 'Os melhores seminovos da região',
          meta_titulo: null,
          meta_descricao: null,
          og_image_url: null,
        },
      ],
    } as never)

    const dados = await buscarDadosPreview('auto-center-silva', 'https://exemplo.supabase.co', 'chave-publica')

    expect(dados).toEqual({
      nomeLoja: 'Auto Center Silva',
      headline: 'Os melhores seminovos da região',
      metaTitulo: null,
      metaDescricao: null,
      ogImageUrl: null,
    })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('slug=eq.auto-center-silva'),
      expect.objectContaining({ headers: { apikey: 'chave-publica', Authorization: 'Bearer chave-publica' } })
    )
  })

  it('retorna null quando não encontra a loja', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => [] } as never)

    expect(await buscarDadosPreview('inexistente', 'https://exemplo.supabase.co', 'chave-publica')).toBeNull()
  })

  it('retorna null quando a requisição falha', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as never)

    expect(
      await buscarDadosPreview('auto-center-silva', 'https://exemplo.supabase.co', 'chave-publica')
    ).toBeNull()
  })
})

describe('montarHtmlPreview', () => {
  it('monta o HTML com os dados da loja', () => {
    const html = montarHtmlPreview({
      nomeLoja: 'Auto Center Silva',
      headline: 'Os melhores seminovos da região',
      metaTitulo: 'Auto Center Silva - Seminovos',
      metaDescricao: 'Os melhores seminovos da região',
      ogImageUrl: 'https://exemplo.com/og.png',
    })

    expect(html).toContain('<title>Auto Center Silva - Seminovos</title>')
    expect(html).toContain('property="og:title" content="Auto Center Silva - Seminovos"')
    expect(html).toContain('property="og:image" content="https://exemplo.com/og.png"')
  })

  it('monta um HTML genérico quando não há dados (loja não encontrada ou vitrine desativada)', () => {
    const html = montarHtmlPreview(null)

    expect(html).toContain('<title>Vitrine ZapCar</title>')
    expect(html).not.toContain('og:image')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- vitrine-preview`
Expected: FAIL com erro de módulo `./vitrine-preview.js` não encontrado

- [ ] **Step 3: Implementar**

`api/vitrine-preview.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface DadosPreview {
  nomeLoja: string | null
  headline: string | null
  metaTitulo: string | null
  metaDescricao: string | null
  ogImageUrl: string | null
}

const BOTS_DE_PREVIEW =
  /facebookexternalhit|WhatsApp|Twitterbot|Slackbot|LinkedInBot|TelegramBot|Discordbot/i

export function ehBotDePreview(userAgent: string | undefined): boolean {
  if (!userAgent) return false
  return BOTS_DE_PREVIEW.test(userAgent)
}

interface LinhaLojaPreview {
  nome_loja: string | null
  vitrine_headline: string | null
  meta_titulo: string | null
  meta_descricao: string | null
  og_image_url: string | null
}

export async function buscarDadosPreview(
  slug: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<DadosPreview | null> {
  const colunas = 'nome_loja,vitrine_headline,meta_titulo,meta_descricao,og_image_url'
  const url =
    `${supabaseUrl}/rest/v1/lojas?select=${colunas}` +
    `&slug=eq.${encodeURIComponent(slug)}&vitrine_publica=eq.true&limit=1`

  const resposta = await fetch(url, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  if (!resposta.ok) return null

  const linhas = (await resposta.json()) as LinhaLojaPreview[]
  const loja = linhas[0]
  if (!loja) return null

  return {
    nomeLoja: loja.nome_loja,
    headline: loja.vitrine_headline,
    metaTitulo: loja.meta_titulo,
    metaDescricao: loja.meta_descricao,
    ogImageUrl: loja.og_image_url,
  }
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function montarHtmlPreview(dados: DadosPreview | null): string {
  const titulo = escaparHtml(dados?.metaTitulo || dados?.nomeLoja || 'Vitrine ZapCar')
  const descricao = escaparHtml(dados?.metaDescricao || dados?.headline || '')
  const imagem = dados?.ogImageUrl ? escaparHtml(dados.ogImageUrl) : null

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>${titulo}</title>
    <meta property="og:title" content="${titulo}" />
    <meta property="og:description" content="${descricao}" />
    ${imagem ? `<meta property="og:image" content="${imagem}" />` : ''}
  </head>
  <body></body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug
  const userAgent = req.headers['user-agent']

  if (typeof slug !== 'string' || !ehBotDePreview(userAgent)) {
    res.status(404).end()
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

  const dados = supabaseUrl && supabaseKey ? await buscarDadosPreview(slug, supabaseUrl, supabaseKey) : null

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(montarHtmlPreview(dados))
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- vitrine-preview`
Expected: PASS (8 testes)

- [ ] **Step 5: Adicionar a regra de rewrite condicionada por bot**

Em `vercel.json`, adicionar a nova regra **antes** da regra catch-all existente:

```json
{
  "rewrites": [
    {
      "source": "/v/:slug",
      "has": [
        {
          "type": "header",
          "key": "user-agent",
          "value": ".*(facebookexternalhit|WhatsApp|Twitterbot|Slackbot|LinkedInBot|TelegramBot|Discordbot).*"
        }
      ],
      "destination": "/api/vitrine-preview?slug=:slug"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 6: Rodar o type-check**

Run: `npx tsc -b`
Expected: sem erros

- [ ] **Step 7: Verificação manual (após o deploy na Vercel)**

Com a vitrine de uma loja de teste ativa, simular um bot de preview:

```bash
curl -A "facebookexternalhit/1.1" "https://zapcar-frontend.vercel.app/v/<slug-da-loja>"
```

Confirmar que a resposta é um HTML com `<meta property="og:title">`/`og:description`/`og:image` preenchidos com os dados da loja. Repetir sem o `-A` (User-Agent de navegador comum) e confirmar que a resposta é o `index.html` normal da SPA. Ferramentas online de teste de preview (ex.: o "Sharing Debugger" do próprio Meta) também servem pra essa verificação, sem precisar do `curl`.

- [ ] **Step 8: Commit**

```bash
git add api/vitrine-preview.ts api/vitrine-preview.test.ts vercel.json
git commit -m "feat: preview de link (OG) da vitrine pública para bots de redes sociais

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Atualizar o roteiro em `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** nenhuma — só documentação.

- [ ] **Step 1: Adicionar a referência da spec/plano**

Em `CLAUDE.md`, logo depois das linhas:

```
Spec de Reordenação manual dos veículos: `docs/superpowers/specs/2026-09-14-reordenacao-veiculos-design.md`
Plano de implementação de Reordenação manual dos veículos: `docs/superpowers/plans/2026-09-14-reordenacao-veiculos.md`
```

adicionar:

```
Spec de Vitrine pública: `docs/superpowers/specs/2026-09-14-vitrine-publica-design.md`
Plano de implementação de Vitrine pública: `docs/superpowers/plans/2026-09-14-vitrine-publica.md`
```

- [ ] **Step 2: Marcar o item 3 (e o 3c) como completo**

Trocar o bloco:

```
3. **Vitrine pública com CTA de WhatsApp** (`/v/:slug`) — dividido em três sub-projetos menores, cada um com spec+plano+implementação próprios:
   - 3a. ~~Configurações da loja~~ ✅ completo.
   - 3b. ~~Reordenação manual dos veículos~~ ✅ completo.
   - 3c. Vitrine pública (`/v/:slug`) propriamente dita — consome os dados de 3a e a ordem de 3b, com CTA de WhatsApp por veículo.
```

por:

```
3. ~~Vitrine pública com CTA de WhatsApp~~ (`/v/:slug`) ✅ completo — dividido em três sub-projetos menores:
   - 3a. ~~Configurações da loja~~ ✅ completo.
   - 3b. ~~Reordenação manual dos veículos~~ ✅ completo.
   - 3c. ~~Vitrine pública (`/v/:slug`)~~ ✅ completo.
```

- [ ] **Step 3: Remover a pendência de back-end já resolvida**

Remover a seção inteira `## Pendência conhecida (não bloqueante)` (o `alter table` que ela descrevia já foi rodado como parte do Global Constraints da Task 4 deste plano).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: marca Vitrine pública (3c) e o item 3 do roteiro como completos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
