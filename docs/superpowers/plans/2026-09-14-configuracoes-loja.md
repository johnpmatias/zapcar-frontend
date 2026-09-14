# Configurações da Loja Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao lojista uma tela `/configuracoes` onde ele edita todos os dados cadastrais da própria loja (identidade, contato, endereço, horários, aparência, textos/imagem de destaque da vitrine, SEO, redes sociais, tracking) — pré-requisito pros sub-projetos 3b (reordenação) e 3c (Vitrine pública).

**Architecture:** Mesmo padrão do CRUD de veículos — camada de dados fina sobre o Supabase JS (`src/lib/loja.ts`, `src/lib/loja-imagens.ts`, `src/lib/slug.ts`) consumida por um hook (`useLoja`) e uma página (`Configuracoes.tsx`) na área protegida, organizada em abas (shadcn `tabs`). Validação com Zod (`src/lib/loja-schema.ts`), formulário com React Hook Form. A linha em `lojas` já existe (trigger `handle_new_user`) — a página só lê e atualiza, nunca cria.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (`base-nova`) + React Router 7 + `@supabase/supabase-js` + React Hook Form + Zod + Vitest + React Testing Library. Nenhuma biblioteca nova além do componente shadcn `tabs`.

**Spec:** `docs/superpowers/specs/2026-09-14-configuracoes-loja-design.md`

## Global Constraints

- Usar sempre a chave **publishable** do Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY`), nunca a `secret key`.
- `lojas.user_id = auth.uid()` (relação 1:1) — toda leitura/escrita da loja filtra por `eq('user_id', user.id)`.
- TDD em todo arquivo de lógica (`schema`, `lib`, hooks, componentes): teste escrito e falhando antes da implementação.
- **Zod instalado é v4**: mensagens customizadas em construtores de tipo usam `{ error: '...' }`, não `invalid_type_error`/`required_error`. `useForm` com resolver Zod usa os três genéricos: `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>(...)`.
- **shadcn `Button` deste projeto não tem prop `asChild`** (primitivas `@base-ui/react`) — usar a prop `render` quando precisar envolver um `Link`. Nesta entrega não há esse caso, mas vale lembrar se aparecer.
- Campos opcionais de texto tratam string vazia como não informado (mesmo padrão `paraIndefinidoSeVazio`/`textoOpcional` já usado em `veiculo-schema.ts`).
- Toda mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **Pendência de back-end, rodar antes da Task 4 (ou antes de testar upload manualmente):** criar o bucket `lojas-imagens` no SQL Editor do Supabase:

```sql
insert into storage.buckets (id, name, public)
values ('lojas-imagens', 'lojas-imagens', true);

create policy "Dono gerencia imagens da própria loja"
on storage.objects for all
using (bucket_id = 'lojas-imagens' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'lojas-imagens' and (storage.foldername(name))[1] = auth.uid()::text);
```

---

## Task 1: Helper de geração de slug

**Files:**
- Create: `src/lib/slug.ts`
- Create: `src/lib/slug.test.ts`

**Interfaces:**
- Produces: `gerarSlug(nome: string): string` — usado pela página de Configurações (Task 9) pra sugerir o slug a partir do nome da loja.

- [ ] **Step 1: Escrever os testes (falhando)**

`src/lib/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { gerarSlug } from '@/lib/slug'

describe('gerarSlug', () => {
  it('converte pra minúsculas e troca espaços por hífen', () => {
    expect(gerarSlug('Auto Center Silva')).toBe('auto-center-silva')
  })

  it('remove acentos', () => {
    expect(gerarSlug('Concessionária São José')).toBe('concessionaria-sao-jose')
  })

  it('remove caracteres inválidos', () => {
    expect(gerarSlug('Loja & Cia!')).toBe('loja-cia')
  })

  it('colapsa hífens repetidos e remove das pontas', () => {
    expect(gerarSlug('  -- Loja --  Top --  ')).toBe('loja-top')
  })

  it('retorna string vazia quando não há nada aproveitável', () => {
    expect(gerarSlug('!!!')).toBe('')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- slug.test`
Expected: FAIL com erro de módulo `@/lib/slug` não encontrado

- [ ] **Step 3: Implementar**

`src/lib/slug.ts`:

```ts
export function gerarSlug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- slug.test`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/slug.test.ts
git commit -m "feat: helper de geração de slug a partir do nome da loja

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Schema de validação Zod da loja

**Files:**
- Create: `src/lib/loja-schema.ts`
- Create: `src/lib/loja-schema.test.ts`

**Interfaces:**
- Produces: `lojaSchema` (Zod), `type LojaFormValues` — usados pela página de Configurações (Task 5).

- [ ] **Step 1: Escrever os testes (falhando)**

`src/lib/loja-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { lojaSchema } from '@/lib/loja-schema'

const dadosMinimos = { nome_loja: 'Auto Center Silva' }

describe('lojaSchema', () => {
  it('aceita só o nome da loja preenchido', () => {
    const resultado = lojaSchema.safeParse(dadosMinimos)
    expect(resultado.success).toBe(true)
  })

  it('rejeita quando falta o nome da loja', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, nome_loja: '' })
    expect(resultado.success).toBe(false)
  })

  it('trata campos opcionais de texto vazios como não informados', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, descricao: '' })
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.descricao).toBeUndefined()
    }
  })

  it('rejeita e-mail em formato inválido', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, email_contato: 'invalido' })
    expect(resultado.success).toBe(false)
  })

  it('aceita e-mail em formato válido', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, email_contato: 'contato@loja.com' })
    expect(resultado.success).toBe(true)
  })

  it('rejeita cor em formato inválido', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, cor_primaria: 'azul' })
    expect(resultado.success).toBe(false)
  })

  it('aceita cor em formato hexadecimal', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, cor_primaria: '#1E40AF' })
    expect(resultado.success).toBe(true)
  })

  it('normaliza o slug para minúsculas e valida o formato', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, slug: 'Auto-Center-Silva' })
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.slug).toBe('auto-center-silva')
    }
  })

  it('rejeita slug com caracteres inválidos', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, slug: 'auto center!' })
    expect(resultado.success).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- loja-schema`
Expected: FAIL com erro de módulo `@/lib/loja-schema` não encontrado

- [ ] **Step 3: Implementar o schema**

`src/lib/loja-schema.ts`:

```ts
import { z } from 'zod'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/
const COR_REGEX = /^#[0-9a-fA-F]{6}$/

const paraIndefinidoSeVazio = (valor: unknown) =>
  valor === '' || valor === null || valor === undefined ? undefined : valor

const textoOpcional = () => z.preprocess(paraIndefinidoSeVazio, z.string().trim().optional())

const emailOpcional = () =>
  z.preprocess(
    paraIndefinidoSeVazio,
    z.string().trim().regex(EMAIL_REGEX, 'E-mail inválido.').optional()
  )

const corOpcional = () =>
  z.preprocess(
    paraIndefinidoSeVazio,
    z.string().trim().regex(COR_REGEX, 'Cor inválida. Use o formato #RRGGBB.').optional()
  )

const slugOpcional = () =>
  z.preprocess(
    (valor) => {
      const semVazio = paraIndefinidoSeVazio(valor)
      return semVazio === undefined ? undefined : String(semVazio).trim().toLowerCase()
    },
    z.string().regex(SLUG_REGEX, 'Use apenas letras minúsculas, números e hífen.').optional()
  )

export const lojaSchema = z.object({
  nome_loja: z.coerce.string().trim().min(1, 'Informe o nome da loja.'),
  descricao: textoOpcional(),
  telefone_contato: textoOpcional(),
  email_contato: emailOpcional(),
  logradouro: textoOpcional(),
  numero: textoOpcional(),
  bairro: textoOpcional(),
  cidade: textoOpcional(),
  estado: textoOpcional(),
  cep: textoOpcional(),
  google_maps_link: textoOpcional(),
  horario_semana_abertura: textoOpcional(),
  horario_semana_fechamento: textoOpcional(),
  horario_sabado_abertura: textoOpcional(),
  horario_sabado_fechamento: textoOpcional(),
  horario_domingo_abertura: textoOpcional(),
  horario_domingo_fechamento: textoOpcional(),
  logo_url: textoOpcional(),
  banner_url: textoOpcional(),
  cor_primaria: corOpcional(),
  cor_secundaria: corOpcional(),
  slug: slugOpcional(),
  vitrine_headline: textoOpcional(),
  vitrine_subheadline: textoOpcional(),
  vitrine_cta_texto: textoOpcional(),
  vitrine_cta_destino: textoOpcional(),
  vitrine_destaque_url: textoOpcional(),
  meta_titulo: textoOpcional(),
  meta_descricao: textoOpcional(),
  og_image_url: textoOpcional(),
  instagram_url: textoOpcional(),
  facebook_url: textoOpcional(),
  tiktok_url: textoOpcional(),
  youtube_url: textoOpcional(),
  meta_pixel_id: textoOpcional(),
  google_tag_id: textoOpcional(),
})

export type LojaFormValues = z.infer<typeof lojaSchema>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- loja-schema`
Expected: PASS (9 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/loja-schema.ts src/lib/loja-schema.test.ts
git commit -m "feat: schema de validação da loja

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Camada de dados — leitura e atualização da loja (`loja.ts`)

**Files:**
- Create: `src/lib/loja.ts`
- Create: `src/lib/loja.test.ts`

**Interfaces:**
- Consumes: nenhuma (usa `supabase` de `@/lib/supabase`, mockado no teste).
- Produces: `interface Loja`, `type LojaPayload`, `getLoja(userId: string): Promise<Loja | null>`, `updateLoja(userId: string, payload: LojaPayload): Promise<Loja>` — usadas pelo hook (Task 5) e pela página (Task 5).

- [ ] **Step 1: Escrever os testes com o client do Supabase mockado**

`src/lib/loja.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { getLoja, updateLoja, type LojaPayload } from '@/lib/loja'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const payloadExemplo: LojaPayload = {
  nome_loja: 'Auto Center Silva',
  descricao: null,
  telefone_contato: null,
  email_contato: null,
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
  slug: null,
  vitrine_headline: null,
  vitrine_subheadline: null,
  vitrine_cta_texto: null,
  vitrine_cta_destino: null,
  vitrine_destaque_url: null,
  vitrine_destaque_tipo: null,
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

beforeEach(() => {
  vi.mocked(supabase.from).mockReset()
})

describe('getLoja', () => {
  it('retorna a loja do usuário', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: '1', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getLoja('user-1')

    expect(supabase.from).toHaveBeenCalledWith('lojas')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(resultado?.id).toBe('1')
  })

  it('retorna null quando não encontra', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    expect(await getLoja('user-1')).toBeNull()
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(getLoja('user-1')).rejects.toThrow('falha de rede')
  })
})

describe('updateLoja', () => {
  it('atualiza a loja do usuário', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: '1', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await updateLoja('user-1', payloadExemplo)

    expect(builder.update).toHaveBeenCalledWith(payloadExemplo)
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('mapeia erro de slug duplicado (código 23505) pra mensagem amigável', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(updateLoja('user-1', payloadExemplo)).rejects.toThrow(
      'Esse endereço já está em uso, escolha outro.'
    )
  })

  it('lança a mensagem original quando o erro não é de duplicidade', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: '23514', message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(updateLoja('user-1', payloadExemplo)).rejects.toThrow('falha de rede')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- loja.test`
Expected: FAIL com erro de módulo `@/lib/loja` não encontrado

- [ ] **Step 3: Implementar**

`src/lib/loja.ts`:

```ts
import { supabase } from '@/lib/supabase'

export interface Loja {
  id: string
  user_id: string
  nome_loja: string | null
  descricao: string | null
  telefone_contato: string | null
  email_contato: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  google_maps_link: string | null
  horario_semana_abertura: string | null
  horario_semana_fechamento: string | null
  horario_sabado_abertura: string | null
  horario_sabado_fechamento: string | null
  horario_domingo_abertura: string | null
  horario_domingo_fechamento: string | null
  logo_url: string | null
  banner_url: string | null
  cor_primaria: string | null
  cor_secundaria: string | null
  slug: string | null
  vitrine_publica: boolean | null
  vitrine_headline: string | null
  vitrine_subheadline: string | null
  vitrine_cta_texto: string | null
  vitrine_cta_destino: string | null
  vitrine_destaque_url: string | null
  vitrine_destaque_tipo: string | null
  meta_titulo: string | null
  meta_descricao: string | null
  og_image_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  youtube_url: string | null
  meta_pixel_id: string | null
  google_tag_id: string | null
  created_at: string
}

export type LojaPayload = Omit<Loja, 'id' | 'user_id' | 'vitrine_publica' | 'created_at'>

const ERRO_SLUG_DUPLICADO = 'Esse endereço já está em uso, escolha outro.'

export async function getLoja(userId: string): Promise<Loja | null> {
  const { data, error } = await supabase.from('lojas').select('*').eq('user_id', userId).maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Loja | null) ?? null
}

export async function updateLoja(userId: string, payload: LojaPayload): Promise<Loja> {
  const { data, error } = await supabase
    .from('lojas')
    .update(payload)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(ERRO_SLUG_DUPLICADO)
    throw new Error(error.message)
  }
  return data as Loja
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- loja.test`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/loja.ts src/lib/loja.test.ts
git commit -m "feat: camada de dados de leitura/atualização da loja

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Storage de imagens da loja (`loja-imagens.ts`)

**Files:**
- Create: `src/lib/loja-imagens.ts`
- Create: `src/lib/loja-imagens.test.ts`

**Interfaces:**
- Produces: `uploadImagemLoja(lojaId: string, campo: string, arquivo: File): Promise<string>`, `removerImagemLoja(url: string): Promise<void>` — usadas pelo componente `ImagemField` (Task 8).

**Antes de testar manualmente esta task**, rode a SQL do bucket `lojas-imagens` listada em "Global Constraints" no SQL Editor do Supabase (os testes automatizados abaixo usam o client mockado e não precisam do bucket real).

- [ ] **Step 1: Escrever os testes com o storage do Supabase mockado**

`src/lib/loja-imagens.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { uploadImagemLoja, removerImagemLoja } from '@/lib/loja-imagens'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

beforeEach(() => {
  vi.mocked(supabase.storage.from).mockReset()
})

describe('uploadImagemLoja', () => {
  it('sobe o arquivo e retorna a URL pública', async () => {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://exemplo.supabase.co/storage/v1/object/public/lojas-imagens/loja-1/logo/img.png' },
      }),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    const url = await uploadImagemLoja('loja-1', 'logo', arquivo)

    expect(supabase.storage.from).toHaveBeenCalledWith('lojas-imagens')
    expect(bucket.upload).toHaveBeenCalled()
    expect(url).toBe('https://exemplo.supabase.co/storage/v1/object/public/lojas-imagens/loja-1/logo/img.png')
  })

  it('lança erro quando o upload falha', async () => {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: { message: 'falha no upload' } }),
      getPublicUrl: vi.fn(),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    await expect(uploadImagemLoja('loja-1', 'logo', arquivo)).rejects.toThrow('falha no upload')
  })
})

describe('removerImagemLoja', () => {
  it('remove pelo caminho extraído da URL pública', async () => {
    const bucket = { remove: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)

    await removerImagemLoja('https://exemplo.supabase.co/storage/v1/object/public/lojas-imagens/loja-1/logo/img.png')

    expect(bucket.remove).toHaveBeenCalledWith(['loja-1/logo/img.png'])
  })

  it('não faz nada quando a URL não pertence ao bucket', async () => {
    const bucket = { remove: vi.fn() }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)

    await removerImagemLoja('https://outro-dominio.com/img.png')

    expect(bucket.remove).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- loja-imagens`
Expected: FAIL com erro de módulo `@/lib/loja-imagens` não encontrado

- [ ] **Step 3: Implementar**

`src/lib/loja-imagens.ts`:

```ts
import { supabase } from '@/lib/supabase'

const BUCKET = 'lojas-imagens'

export async function uploadImagemLoja(lojaId: string, campo: string, arquivo: File): Promise<string> {
  const extensao = arquivo.name.split('.').pop() ?? 'jpg'
  const caminho = `${lojaId}/${campo}/${crypto.randomUUID()}.${extensao}`

  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho)
  return data.publicUrl
}

export async function removerImagemLoja(url: string): Promise<void> {
  const marcador = `/storage/v1/object/public/${BUCKET}/`
  const indice = url.indexOf(marcador)
  if (indice === -1) return

  const caminho = decodeURIComponent(url.slice(indice + marcador.length))
  const { error } = await supabase.storage.from(BUCKET).remove([caminho])
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- loja-imagens`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/loja-imagens.ts src/lib/loja-imagens.test.ts
git commit -m "feat: upload e remoção de imagens da loja no Storage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Hook `useLoja` + página de Configurações — aba "Dados básicos", fim a fim

**Files:**
- Create: `src/hooks/useLoja.ts`
- Create: `src/pages/Configuracoes.tsx`
- Create: `src/pages/Configuracoes.test.tsx`
- Modify: `src/App.tsx` (rota `/configuracoes`)
- Modify: `src/pages/Dashboard.tsx` (link para `/configuracoes`)

**Interfaces:**
- Consumes: `getLoja`, `updateLoja`, `type Loja`, `type LojaPayload` (Task 3); `lojaSchema`, `type LojaFormValues` (Task 2).
- Produces: hook `useLoja(userId: string | undefined)` retornando `{ loja: Loja | null; carregando: boolean; erro: string | null; recarregar: () => void }`; componente `ConfiguracoesPage` — será estendido nas Tasks 6 a 12 (mesmo arquivo, sem trocar de nome/export). **Já inclui nesta task o `defaultValues`, o mapeamento de `reset()` (36 campos do schema) e o payload de `onSubmit` (37 campos, incluindo `vitrine_destaque_tipo`, derivado e fora do schema)** — as tasks seguintes só adicionam os `<Input>`/componentes de UI dos campos que ainda não aparecem na tela; a plumbing de dados não muda mais depois desta task.

Este task entrega só a aba/seção "Dados básicos" (`nome_loja`, `descricao`, `telefone_contato`, `email_contato`) visível na tela — sem abas ainda (chega na Task 6). O objetivo é ter um ciclo completo de carregar → editar → salvar funcionando de ponta a ponta.

- [ ] **Step 1: Escrever o teste da página (falhando)**

`src/pages/Configuracoes.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ConfiguracoesPage from '@/pages/Configuracoes'
import { getLoja, updateLoja } from '@/lib/loja'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/lib/loja', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/loja')>()),
  getLoja: vi.fn(),
  updateLoja: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const lojaExemplo = {
  id: 'user-1',
  user_id: 'user-1',
  nome_loja: 'Auto Center Silva',
  descricao: null,
  telefone_contato: null,
  email_contato: null,
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
  slug: null,
  vitrine_publica: false,
  vitrine_headline: null,
  vitrine_subheadline: null,
  vitrine_cta_texto: null,
  vitrine_cta_destino: null,
  vitrine_destaque_url: null,
  vitrine_destaque_tipo: null,
  meta_titulo: null,
  meta_descricao: null,
  og_image_url: null,
  instagram_url: null,
  facebook_url: null,
  tiktok_url: null,
  youtube_url: null,
  meta_pixel_id: null,
  google_tag_id: null,
  created_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.mocked(getLoja).mockReset()
  vi.mocked(updateLoja).mockReset()
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user-1' },
    session: {} as never,
    loading: false,
    signOut: vi.fn(),
  })
})

function renderPagina() {
  return render(
    <MemoryRouter>
      <ConfiguracoesPage />
    </MemoryRouter>
  )
}

describe('ConfiguracoesPage', () => {
  it('carrega e mostra os dados básicos existentes', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)

    renderPagina()

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(await screen.findByLabelText(/nome da loja/i)).toHaveValue('Auto Center Silva')
  })

  it('edita e salva os dados básicos', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    const campoTelefone = await screen.findByLabelText(/telefone/i)
    await usuario.type(campoTelefone, '11999999999')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ nome_loja: 'Auto Center Silva', telefone_contato: '11999999999' })
    )
  })

  it('mostra erro de validação quando o nome da loja fica vazio', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    const campoNome = await screen.findByLabelText(/nome da loja/i)
    await usuario.clear(campoNome)
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/informe o nome da loja/i)).toBeInTheDocument()
    expect(updateLoja).not.toHaveBeenCalled()
  })

  it('mostra erro com botão de tentar novamente quando falha ao carregar', async () => {
    vi.mocked(getLoja).mockRejectedValue(new Error('falha de rede'))

    renderPagina()

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Configuracoes.test`
Expected: FAIL (módulo `@/pages/Configuracoes` não existe)

- [ ] **Step 3: Implementar o hook**

`src/hooks/useLoja.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { getLoja, type Loja } from '@/lib/loja'

export function useLoja(userId: string | undefined) {
  const [loja, setLoja] = useState<Loja | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    if (!userId) return
    setCarregando(true)
    setErro(null)
    getLoja(userId)
      .then(setLoja)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [userId])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { loja, carregando, erro, recarregar: carregar }
}
```

- [ ] **Step 4: Implementar a página**

`src/pages/Configuracoes.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useLoja } from '@/hooks/useLoja'
import { lojaSchema, type LojaFormValues } from '@/lib/loja-schema'
import { updateLoja, type LojaPayload } from '@/lib/loja'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ERRO_SLUG_DUPLICADO = 'Esse endereço já está em uso, escolha outro.'

const valoresIniciais: z.input<typeof lojaSchema> = {
  nome_loja: '',
  descricao: undefined,
  telefone_contato: undefined,
  email_contato: undefined,
  logradouro: undefined,
  numero: undefined,
  bairro: undefined,
  cidade: undefined,
  estado: undefined,
  cep: undefined,
  google_maps_link: undefined,
  horario_semana_abertura: undefined,
  horario_semana_fechamento: undefined,
  horario_sabado_abertura: undefined,
  horario_sabado_fechamento: undefined,
  horario_domingo_abertura: undefined,
  horario_domingo_fechamento: undefined,
  logo_url: undefined,
  banner_url: undefined,
  cor_primaria: undefined,
  cor_secundaria: undefined,
  slug: undefined,
  vitrine_headline: undefined,
  vitrine_subheadline: undefined,
  vitrine_cta_texto: undefined,
  vitrine_cta_destino: undefined,
  vitrine_destaque_url: undefined,
  meta_titulo: undefined,
  meta_descricao: undefined,
  og_image_url: undefined,
  instagram_url: undefined,
  facebook_url: undefined,
  tiktok_url: undefined,
  youtube_url: undefined,
  meta_pixel_id: undefined,
  google_tag_id: undefined,
}

export default function ConfiguracoesPage() {
  const { user } = useAuth()
  const { loja, carregando, erro, recarregar } = useLoja(user?.id)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  const form = useForm<z.input<typeof lojaSchema>, unknown, z.output<typeof lojaSchema>>({
    resolver: zodResolver(lojaSchema),
    defaultValues: valoresIniciais,
  })

  useEffect(() => {
    if (!loja) return
    form.reset({
      nome_loja: loja.nome_loja ?? '',
      descricao: loja.descricao ?? undefined,
      telefone_contato: loja.telefone_contato ?? undefined,
      email_contato: loja.email_contato ?? undefined,
      logradouro: loja.logradouro ?? undefined,
      numero: loja.numero ?? undefined,
      bairro: loja.bairro ?? undefined,
      cidade: loja.cidade ?? undefined,
      estado: loja.estado ?? undefined,
      cep: loja.cep ?? undefined,
      google_maps_link: loja.google_maps_link ?? undefined,
      horario_semana_abertura: loja.horario_semana_abertura ?? undefined,
      horario_semana_fechamento: loja.horario_semana_fechamento ?? undefined,
      horario_sabado_abertura: loja.horario_sabado_abertura ?? undefined,
      horario_sabado_fechamento: loja.horario_sabado_fechamento ?? undefined,
      horario_domingo_abertura: loja.horario_domingo_abertura ?? undefined,
      horario_domingo_fechamento: loja.horario_domingo_fechamento ?? undefined,
      logo_url: loja.logo_url ?? undefined,
      banner_url: loja.banner_url ?? undefined,
      cor_primaria: loja.cor_primaria ?? undefined,
      cor_secundaria: loja.cor_secundaria ?? undefined,
      slug: loja.slug ?? undefined,
      vitrine_headline: loja.vitrine_headline ?? undefined,
      vitrine_subheadline: loja.vitrine_subheadline ?? undefined,
      vitrine_cta_texto: loja.vitrine_cta_texto ?? undefined,
      vitrine_cta_destino: loja.vitrine_cta_destino ?? undefined,
      vitrine_destaque_url: loja.vitrine_destaque_url ?? undefined,
      meta_titulo: loja.meta_titulo ?? undefined,
      meta_descricao: loja.meta_descricao ?? undefined,
      og_image_url: loja.og_image_url ?? undefined,
      instagram_url: loja.instagram_url ?? undefined,
      facebook_url: loja.facebook_url ?? undefined,
      tiktok_url: loja.tiktok_url ?? undefined,
      youtube_url: loja.youtube_url ?? undefined,
      meta_pixel_id: loja.meta_pixel_id ?? undefined,
      google_tag_id: loja.google_tag_id ?? undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loja])

  if (!user || carregando) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  if (erro) {
    return (
      <div className="flex flex-col items-start gap-2 p-4">
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
    return <p className="text-muted-foreground">Loja não encontrada. Contate o suporte.</p>
  }

  async function onSubmit(valores: LojaFormValues) {
    setErroSalvar(null)
    setSalvo(false)
    setSalvando(true)

    const payload: LojaPayload = {
      nome_loja: valores.nome_loja,
      descricao: valores.descricao ?? null,
      telefone_contato: valores.telefone_contato ?? null,
      email_contato: valores.email_contato ?? null,
      logradouro: valores.logradouro ?? null,
      numero: valores.numero ?? null,
      bairro: valores.bairro ?? null,
      cidade: valores.cidade ?? null,
      estado: valores.estado ?? null,
      cep: valores.cep ?? null,
      google_maps_link: valores.google_maps_link ?? null,
      horario_semana_abertura: valores.horario_semana_abertura ?? null,
      horario_semana_fechamento: valores.horario_semana_fechamento ?? null,
      horario_sabado_abertura: valores.horario_sabado_abertura ?? null,
      horario_sabado_fechamento: valores.horario_sabado_fechamento ?? null,
      horario_domingo_abertura: valores.horario_domingo_abertura ?? null,
      horario_domingo_fechamento: valores.horario_domingo_fechamento ?? null,
      logo_url: valores.logo_url ?? null,
      banner_url: valores.banner_url ?? null,
      cor_primaria: valores.cor_primaria ?? null,
      cor_secundaria: valores.cor_secundaria ?? null,
      slug: valores.slug ?? null,
      vitrine_headline: valores.vitrine_headline ?? null,
      vitrine_subheadline: valores.vitrine_subheadline ?? null,
      vitrine_cta_texto: valores.vitrine_cta_texto ?? null,
      vitrine_cta_destino: valores.vitrine_cta_destino ?? null,
      vitrine_destaque_url: valores.vitrine_destaque_url ?? null,
      vitrine_destaque_tipo: valores.vitrine_destaque_url ? 'imagem' : null,
      meta_titulo: valores.meta_titulo ?? null,
      meta_descricao: valores.meta_descricao ?? null,
      og_image_url: valores.og_image_url ?? null,
      instagram_url: valores.instagram_url ?? null,
      facebook_url: valores.facebook_url ?? null,
      tiktok_url: valores.tiktok_url ?? null,
      youtube_url: valores.youtube_url ?? null,
      meta_pixel_id: valores.meta_pixel_id ?? null,
      google_tag_id: valores.google_tag_id ?? null,
    }

    try {
      await updateLoja(user!.id, payload)
      setSalvo(true)
    } catch (e) {
      const mensagem = (e as Error).message
      if (mensagem === ERRO_SLUG_DUPLICADO) {
        form.setError('slug', { type: 'manual', message: mensagem })
      } else {
        setErroSalvar(mensagem)
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Configurações da loja</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit, () => setSalvo(false))}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome_loja">Nome da loja</Label>
              <Input id="nome_loja" {...form.register('nome_loja')} />
              {form.formState.errors.nome_loja && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.nome_loja.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" {...form.register('descricao')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="telefone_contato">Telefone / WhatsApp</Label>
              <Input id="telefone_contato" {...form.register('telefone_contato')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email_contato">E-mail de contato</Label>
              <Input id="email_contato" {...form.register('email_contato')} />
              {form.formState.errors.email_contato && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.email_contato.message}
                </p>
              )}
            </div>

            {erroSalvar && (
              <p role="alert" className="text-sm text-destructive">
                {erroSalvar}
              </p>
            )}
            {salvo && (
              <p role="status" className="text-sm text-muted-foreground">
                Alterações salvas.
              </p>
            )}

            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Registrar a rota e o link no Dashboard**

Em `src/App.tsx`, importar `ConfiguracoesPage` e adicionar a rota dentro da área protegida:

```tsx
import ConfiguracoesPage from '@/pages/Configuracoes'
```

```tsx
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute>
            <ConfiguracoesPage />
          </ProtectedRoute>
        }
      />
```

Em `src/pages/Dashboard.tsx`, adicionar um link junto ao de "Ver veículos" já existente:

```tsx
      <Link to="/configuracoes" className="underline">
        Configurações da loja
      </Link>
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- Configuracoes.test`
Expected: PASS (4 testes)

- [ ] **Step 7: Verificação manual**

Run: `npm run dev`, acessar `/`, clicar em "Configurações da loja", confirmar que `/configuracoes` carrega o nome da loja já cadastrado, editar telefone e salvar, ver "Alterações salvas." e confirmar no Supabase (Table Editor) que a coluna `telefone_contato` foi atualizada.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useLoja.ts src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx src/App.tsx src/pages/Dashboard.tsx
git commit -m "feat: tela de Configurações da loja — aba Dados básicos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Abas + seção "Endereço e horários"

**Files:**
- Modify: `src/pages/Configuracoes.tsx`
- Modify: `src/pages/Configuracoes.test.tsx`
- Modify: `package.json` (dependência do componente `tabs`, se o CLI adicionar alguma)

**Interfaces:**
- Consumes: nenhuma nova.
- Produces: nenhuma nova (só estende a UI já existente).

- [ ] **Step 1: Instalar o componente `tabs` do shadcn**

```bash
npx shadcn@latest add tabs
```

- [ ] **Step 2: Adicionar o teste da nova aba (falhando)**

Em `src/pages/Configuracoes.test.tsx`, adicionar este teste dentro do `describe('ConfiguracoesPage', ...)` já existente:

```tsx
  it('edita e salva um campo de endereço na aba Endereço', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /endereço/i }))
    await usuario.type(screen.getByLabelText(/^cidade$/i), 'São Paulo')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith('user-1', expect.objectContaining({ cidade: 'São Paulo' }))
  })
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- Configuracoes.test`
Expected: FAIL (não existe elemento com role `tab`/"Endereço" nem label "Cidade")

- [ ] **Step 4: Envolver os campos existentes em abas e adicionar a aba "Endereço"**

Em `src/pages/Configuracoes.tsx`, adicionar o import:

```tsx
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
```

Substituir o `<form onSubmit={...} className="flex flex-col gap-4">` (e seu conteúdo até o botão "Salvar") por:

```tsx
          <form
            onSubmit={form.handleSubmit(onSubmit, () => setSalvo(false))}
            className="flex flex-col gap-4"
          >
            <Tabs defaultValue="basico">
              <TabsList>
                <TabsTrigger value="basico">Dados básicos</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
              </TabsList>

              <TabsContent value="basico" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nome_loja">Nome da loja</Label>
                  <Input id="nome_loja" {...form.register('nome_loja')} />
                  {form.formState.errors.nome_loja && (
                    <p role="alert" className="text-sm text-destructive">
                      {form.formState.errors.nome_loja.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input id="descricao" {...form.register('descricao')} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="telefone_contato">Telefone / WhatsApp</Label>
                  <Input id="telefone_contato" {...form.register('telefone_contato')} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email_contato">E-mail de contato</Label>
                  <Input id="email_contato" {...form.register('email_contato')} />
                  {form.formState.errors.email_contato && (
                    <p role="alert" className="text-sm text-destructive">
                      {form.formState.errors.email_contato.message}
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="endereco" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input id="logradouro" {...form.register('logradouro')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" {...form.register('numero')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" {...form.register('bairro')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" {...form.register('cidade')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input id="estado" {...form.register('estado')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input id="cep" {...form.register('cep')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="google_maps_link">Link do Google Maps</Label>
                  <Input id="google_maps_link" {...form.register('google_maps_link')} />
                </div>

                <p className="text-sm font-medium">Horário de funcionamento</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_semana_abertura">Seg-sex, abertura</Label>
                    <Input id="horario_semana_abertura" type="time" {...form.register('horario_semana_abertura')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_semana_fechamento">Seg-sex, fechamento</Label>
                    <Input id="horario_semana_fechamento" type="time" {...form.register('horario_semana_fechamento')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_sabado_abertura">Sábado, abertura</Label>
                    <Input id="horario_sabado_abertura" type="time" {...form.register('horario_sabado_abertura')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_sabado_fechamento">Sábado, fechamento</Label>
                    <Input id="horario_sabado_fechamento" type="time" {...form.register('horario_sabado_fechamento')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_domingo_abertura">Domingo, abertura</Label>
                    <Input id="horario_domingo_abertura" type="time" {...form.register('horario_domingo_abertura')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_domingo_fechamento">Domingo, fechamento</Label>
                    <Input id="horario_domingo_fechamento" type="time" {...form.register('horario_domingo_fechamento')} />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Deixe os dois campos de um dia em branco se a loja não abre nesse dia.</p>
              </TabsContent>
            </Tabs>

            {erroSalvar && (
              <p role="alert" className="text-sm text-destructive">
                {erroSalvar}
              </p>
            )}
            {salvo && (
              <p role="status" className="text-sm text-muted-foreground">
                Alterações salvas.
              </p>
            )}

            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- Configuracoes.test`
Expected: PASS (5 testes)

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`, acessar `/configuracoes`, alternar entre as abas "Dados básicos" e "Endereço", preencher cidade e um horário, salvar, confirmar no Supabase.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx package.json package-lock.json src/components/ui/tabs.tsx
git commit -m "feat: abas de Configurações + aba Endereço e horários

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Componente `CorField` + aba "Aparência" (cores)

**Files:**
- Create: `src/components/loja/CorField.tsx`
- Create: `src/components/loja/CorField.test.tsx`
- Modify: `src/pages/Configuracoes.tsx`
- Modify: `src/pages/Configuracoes.test.tsx`

**Interfaces:**
- Produces: `CorField` — `{ id: string; label: string; value: string | undefined; onChange: (valor: string) => void }`, reaproveitável para `cor_primaria` e `cor_secundaria`.

- [ ] **Step 1: Escrever o teste do `CorField` (falhando)**

`src/components/loja/CorField.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CorField } from '@/components/loja/CorField'

function CorFieldControlado() {
  const [valor, setValor] = useState<string | undefined>(undefined)
  return <CorField id="cor" label="Cor primária" value={valor} onChange={setValor} />
}

describe('CorField', () => {
  it('atualiza o valor ao digitar o hexadecimal', async () => {
    const usuario = userEvent.setup()
    render(<CorFieldControlado />)

    await usuario.type(screen.getByLabelText('Cor primária'), '#1e40af')

    expect(screen.getByLabelText('Cor primária')).toHaveValue('#1e40af')
  })

  it('atualiza o valor ao usar o seletor de cor nativo', () => {
    render(<CorFieldControlado />)

    fireEvent.change(screen.getByLabelText('Selecionar cor primária'), {
      target: { value: '#00ff00' },
    })

    expect(screen.getByLabelText('Cor primária')).toHaveValue('#00ff00')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- CorField`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar `CorField`**

`src/components/loja/CorField.tsx`:

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CorFieldProps {
  id: string
  label: string
  value: string | undefined
  onChange: (valor: string) => void
}

const COR_REGEX = /^#[0-9a-fA-F]{6}$/

export function CorField({ id, label, value, onChange }: CorFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Selecionar ${label.toLowerCase()}`}
          value={value && COR_REGEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border"
        />
        <Input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="#1E40AF" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- CorField`
Expected: PASS (2 testes)

- [ ] **Step 5: Adicionar o teste da aba "Aparência" (falhando)**

Em `src/pages/Configuracoes.test.tsx`, adicionar:

```tsx
  it('edita e salva a cor primária na aba Aparência', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /aparência/i }))
    await usuario.type(screen.getByLabelText('Cor primária'), '#112233')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith('user-1', expect.objectContaining({ cor_primaria: '#112233' }))
  })
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npm test -- Configuracoes.test`
Expected: FAIL (não existe aba "Aparência")

- [ ] **Step 7: Adicionar a aba "Aparência" com os dois campos de cor**

Em `src/pages/Configuracoes.tsx`, importar `CorField`:

```tsx
import { CorField } from '@/components/loja/CorField'
```

Adicionar mais um `TabsTrigger` na `TabsList` (depois de "Endereço"):

```tsx
                <TabsTrigger value="aparencia">Aparência</TabsTrigger>
```

E adicionar o novo `TabsContent`, depois do `TabsContent value="endereco"` já existente:

```tsx
              <TabsContent value="aparencia" className="flex flex-col gap-4">
                <CorField
                  id="cor_primaria"
                  label="Cor primária"
                  value={form.watch('cor_primaria')}
                  onChange={(valor) => form.setValue('cor_primaria', valor)}
                />
                <CorField
                  id="cor_secundaria"
                  label="Cor secundária"
                  value={form.watch('cor_secundaria')}
                  onChange={(valor) => form.setValue('cor_secundaria', valor)}
                />
              </TabsContent>
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `npm test -- Configuracoes.test`
Expected: PASS (6 testes)

- [ ] **Step 9: Commit**

```bash
git add src/components/loja/CorField.tsx src/components/loja/CorField.test.tsx src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: campo de cor e aba Aparência (cores)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Componente `ImagemField` + logo e banner na aba "Aparência"

**Files:**
- Create: `src/components/loja/ImagemField.tsx`
- Create: `src/components/loja/ImagemField.test.tsx`
- Modify: `src/pages/Configuracoes.tsx`
- Modify: `src/pages/Configuracoes.test.tsx`

**Interfaces:**
- Consumes: `uploadImagemLoja`, `removerImagemLoja` (Task 4).
- Produces: `ImagemField` — `{ lojaId: string; campo: string; label: string; value: string | undefined; onChange: (url: string | undefined) => void }`, reaproveitável para `logo_url`, `banner_url` (aqui), `vitrine_destaque_url` (Task 10) e `og_image_url` (Task 11).

- [ ] **Step 1: Escrever o teste do `ImagemField` (falhando)**

`src/components/loja/ImagemField.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImagemField } from '@/components/loja/ImagemField'
import { uploadImagemLoja, removerImagemLoja } from '@/lib/loja-imagens'

vi.mock('@/lib/loja-imagens', () => ({
  uploadImagemLoja: vi.fn(),
  removerImagemLoja: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(uploadImagemLoja).mockReset()
  vi.mocked(removerImagemLoja).mockReset()
})

describe('ImagemField', () => {
  it('sobe o arquivo selecionado e chama onChange com a URL', async () => {
    vi.mocked(uploadImagemLoja).mockResolvedValue('https://exemplo.com/logo.png')
    const onChange = vi.fn()
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    render(<ImagemField lojaId="loja-1" campo="logo" label="Logo" value={undefined} onChange={onChange} />)

    await usuario.upload(screen.getByLabelText('Logo'), arquivo)

    expect(uploadImagemLoja).toHaveBeenCalledWith('loja-1', 'logo', arquivo)
    expect(onChange).toHaveBeenCalledWith('https://exemplo.com/logo.png')
  })

  it('mostra erro inline quando o upload falha', async () => {
    vi.mocked(uploadImagemLoja).mockRejectedValue(new Error('falha no upload'))
    const onChange = vi.fn()
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    render(<ImagemField lojaId="loja-1" campo="logo" label="Logo" value={undefined} onChange={onChange} />)

    await usuario.upload(screen.getByLabelText('Logo'), arquivo)

    expect(await screen.findByText('falha no upload')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('remove a imagem existente', async () => {
    vi.mocked(removerImagemLoja).mockResolvedValue(undefined)
    const onChange = vi.fn()
    const usuario = userEvent.setup()

    render(
      <ImagemField lojaId="loja-1" campo="logo" label="Logo" value="https://exemplo.com/logo.png" onChange={onChange} />
    )

    await usuario.click(screen.getByRole('button', { name: /remover/i }))

    expect(removerImagemLoja).toHaveBeenCalledWith('https://exemplo.com/logo.png')
    expect(onChange).toHaveBeenCalledWith(undefined)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- ImagemField`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar `ImagemField`**

`src/components/loja/ImagemField.tsx`:

```tsx
import { useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { uploadImagemLoja, removerImagemLoja } from '@/lib/loja-imagens'

interface ImagemFieldProps {
  lojaId: string
  campo: string
  label: string
  value: string | undefined
  onChange: (url: string | undefined) => void
}

export function ImagemField({ lojaId, campo, label, value, onChange }: ImagemFieldProps) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return

    setErro(null)
    setEnviando(true)
    try {
      const url = await uploadImagemLoja(lojaId, campo, arquivo)
      onChange(url)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function remover() {
    if (!value) return
    await removerImagemLoja(value)
    onChange(undefined)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`imagem-${campo}`}>{label}</Label>
      {value && (
        <div className="flex flex-col items-start gap-2">
          <img src={value} alt={label} className="h-24 w-auto rounded object-cover" />
          <Button type="button" variant="destructive" size="xs" onClick={remover}>
            Remover
          </Button>
        </div>
      )}
      <input id={`imagem-${campo}`} type="file" accept="image/*" onChange={aoSelecionarArquivo} disabled={enviando} />
      {enviando && <p className="text-sm text-muted-foreground">Enviando...</p>}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- ImagemField`
Expected: PASS (3 testes)

- [ ] **Step 5: Adicionar o teste do upload de logo na página (falhando)**

Em `src/pages/Configuracoes.test.tsx`, mockar `@/lib/loja-imagens` no topo do arquivo:

```tsx
vi.mock('@/lib/loja-imagens', () => ({
  uploadImagemLoja: vi.fn(),
  removerImagemLoja: vi.fn(),
}))
```

E adicionar o teste:

```tsx
  it('sobe a logo e envia a URL ao salvar', async () => {
    const { uploadImagemLoja } = await import('@/lib/loja-imagens')
    vi.mocked(uploadImagemLoja).mockResolvedValue('https://exemplo.com/logo.png')
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /aparência/i }))
    await usuario.upload(screen.getByLabelText('Logo'), arquivo)
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ logo_url: 'https://exemplo.com/logo.png' })
    )
  })
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npm test -- Configuracoes.test`
Expected: FAIL (não existe label "Logo" na página)

- [ ] **Step 7: Adicionar `ImagemField` de logo e banner na aba "Aparência"**

Em `src/pages/Configuracoes.tsx`, importar:

```tsx
import { ImagemField } from '@/components/loja/ImagemField'
```

Dentro do `TabsContent value="aparencia"`, antes dos dois `CorField`:

```tsx
                <ImagemField
                  lojaId={user!.id}
                  campo="logo"
                  label="Logo"
                  value={form.watch('logo_url')}
                  onChange={(url) => form.setValue('logo_url', url)}
                />
                <ImagemField
                  lojaId={user!.id}
                  campo="banner"
                  label="Banner"
                  value={form.watch('banner_url')}
                  onChange={(url) => form.setValue('banner_url', url)}
                />
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `npm test -- Configuracoes.test`
Expected: PASS (7 testes)

- [ ] **Step 9: Verificação manual**

Confirme que a SQL do bucket `lojas-imagens` (Global Constraints) já foi rodada no Supabase. Run: `npm run dev`, acessar `/configuracoes` → aba "Aparência", subir uma imagem de logo, confirmar preview e que salvar grava a URL em `logo_url`.

- [ ] **Step 10: Commit**

```bash
git add src/components/loja/ImagemField.tsx src/components/loja/ImagemField.test.tsx src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: campo de upload de imagem e logo/banner na aba Aparência

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Aba "Vitrine" — slug com sugestão automática + textos

**Files:**
- Modify: `src/pages/Configuracoes.tsx`
- Modify: `src/pages/Configuracoes.test.tsx`

**Interfaces:**
- Consumes: `gerarSlug` (Task 1).

- [ ] **Step 1: Adicionar os testes da aba "Vitrine" (falhando)**

Em `src/pages/Configuracoes.test.tsx`, adicionar:

```tsx
  it('sugere o slug automaticamente a partir do nome enquanto ele estiver vazio', async () => {
    vi.mocked(getLoja).mockResolvedValue({ ...lojaExemplo, nome_loja: '', slug: null } as never)
    const usuario = userEvent.setup()

    renderPagina()

    await usuario.type(await screen.findByLabelText(/nome da loja/i), 'Auto Center Silva')
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))

    expect(screen.getByLabelText(/endereço da vitrine/i)).toHaveValue('auto-center-silva')
  })

  it('para de sugerir o slug depois que o lojista edita o campo manualmente', async () => {
    vi.mocked(getLoja).mockResolvedValue({ ...lojaExemplo, nome_loja: '', slug: null } as never)
    const usuario = userEvent.setup()

    renderPagina()

    await usuario.type(await screen.findByLabelText(/nome da loja/i), 'Auto Center Silva')
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))
    const campoSlug = screen.getByLabelText(/endereço da vitrine/i)
    await usuario.clear(campoSlug)
    await usuario.type(campoSlug, 'minha-loja-top')
    await usuario.click(screen.getByRole('tab', { name: /dados básicos/i }))
    await usuario.type(screen.getByLabelText(/nome da loja/i), ' Ltda')
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))

    expect(screen.getByLabelText(/endereço da vitrine/i)).toHaveValue('minha-loja-top')
  })

  it('mostra erro no campo slug quando o Supabase retorna duplicidade', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockRejectedValue(new Error('Esse endereço já está em uso, escolha outro.'))
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))
    await usuario.type(screen.getByLabelText(/endereço da vitrine/i), 'ja-existe')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText('Esse endereço já está em uso, escolha outro.')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Configuracoes.test`
Expected: FAIL (não existe aba "Vitrine" nem label "Endereço da vitrine")

- [ ] **Step 3: Implementar a aba "Vitrine" com sugestão automática de slug**

Em `src/pages/Configuracoes.tsx`, importar `gerarSlug`:

```tsx
import { gerarSlug } from '@/lib/slug'
```

Adicionar, dentro do componente, depois da declaração de `form`:

```tsx
  const nomeLoja = form.watch('nome_loja')

  useEffect(() => {
    if (form.formState.dirtyFields.slug) return
    if (form.getValues('slug')) return
    form.setValue('slug', gerarSlug(nomeLoja ?? ''))
  }, [nomeLoja, form])
```

Adicionar mais um `TabsTrigger`:

```tsx
                <TabsTrigger value="vitrine">Vitrine</TabsTrigger>
```

E o `TabsContent`, depois do `TabsContent value="aparencia"`:

```tsx
              <TabsContent value="vitrine" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="slug">Endereço da vitrine</Label>
                  <Input id="slug" {...form.register('slug')} />
                  {form.formState.errors.slug && (
                    <p role="alert" className="text-sm text-destructive">
                      {form.formState.errors.slug.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vitrine_headline">Título de destaque</Label>
                  <Input id="vitrine_headline" {...form.register('vitrine_headline')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vitrine_subheadline">Subtítulo</Label>
                  <Input id="vitrine_subheadline" {...form.register('vitrine_subheadline')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vitrine_cta_texto">Texto do botão de destaque</Label>
                  <Input id="vitrine_cta_texto" {...form.register('vitrine_cta_texto')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vitrine_cta_destino">Link do botão de destaque</Label>
                  <Input id="vitrine_cta_destino" {...form.register('vitrine_cta_destino')} />
                </div>
              </TabsContent>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- Configuracoes.test`
Expected: PASS (10 testes)

- [ ] **Step 5: Verificação manual**

Run: `npm run dev`, acessar `/configuracoes`, limpar o campo "Nome da loja" e digitar um nome novo, ir pra aba "Vitrine" e confirmar que o slug foi sugerido; editar o slug manualmente, voltar pra "Dados básicos" e mudar o nome de novo, confirmar que o slug editado não foi sobrescrito.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: aba Vitrine com sugestão automática de slug

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Imagem de destaque da Vitrine

**Files:**
- Modify: `src/pages/Configuracoes.tsx`
- Modify: `src/pages/Configuracoes.test.tsx`

**Interfaces:**
- Consumes: `ImagemField` (Task 8).

- [ ] **Step 1: Adicionar o teste (falhando)**

Em `src/pages/Configuracoes.test.tsx`, adicionar:

```tsx
  it('sobe a imagem de destaque da vitrine e grava o tipo como imagem', async () => {
    const { uploadImagemLoja } = await import('@/lib/loja-imagens')
    vi.mocked(uploadImagemLoja).mockResolvedValue('https://exemplo.com/destaque.png')
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'destaque.png', { type: 'image/png' })

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))
    await usuario.upload(screen.getByLabelText(/imagem de destaque/i), arquivo)
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ vitrine_destaque_url: 'https://exemplo.com/destaque.png', vitrine_destaque_tipo: 'imagem' })
    )
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Configuracoes.test`
Expected: FAIL (não existe label "Imagem de destaque")

- [ ] **Step 3: Adicionar o campo**

Em `src/pages/Configuracoes.tsx`, dentro do `TabsContent value="vitrine"`, depois do campo `vitrine_cta_destino`:

```tsx
                <ImagemField
                  lojaId={user!.id}
                  campo="destaque"
                  label="Imagem de destaque"
                  value={form.watch('vitrine_destaque_url')}
                  onChange={(url) => form.setValue('vitrine_destaque_url', url)}
                />
```

(`vitrine_destaque_tipo` já é gravado como `'imagem'` no `onSubmit` desde a Task 5, condicionado à presença de `vitrine_destaque_url` — nenhuma mudança necessária ali.)

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- Configuracoes.test`
Expected: PASS (11 testes)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: imagem de destaque da vitrine

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Aba "SEO"

**Files:**
- Modify: `src/pages/Configuracoes.tsx`
- Modify: `src/pages/Configuracoes.test.tsx`

- [ ] **Step 1: Adicionar o teste (falhando)**

Em `src/pages/Configuracoes.test.tsx`, adicionar:

```tsx
  it('edita e salva os campos de SEO', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /seo/i }))
    await usuario.type(screen.getByLabelText(/título para busca/i), 'Auto Center Silva - Carros seminovos')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ meta_titulo: 'Auto Center Silva - Carros seminovos' })
    )
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Configuracoes.test`
Expected: FAIL (não existe aba "SEO")

- [ ] **Step 3: Implementar a aba**

Em `src/pages/Configuracoes.tsx`, adicionar o `TabsTrigger`:

```tsx
                <TabsTrigger value="seo">SEO</TabsTrigger>
```

E o `TabsContent`, depois do `TabsContent value="vitrine"`:

```tsx
              <TabsContent value="seo" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="meta_titulo">Título para busca</Label>
                  <Input id="meta_titulo" {...form.register('meta_titulo')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="meta_descricao">Descrição para busca</Label>
                  <Input id="meta_descricao" {...form.register('meta_descricao')} />
                </div>
                <ImagemField
                  lojaId={user!.id}
                  campo="og-image"
                  label="Imagem de compartilhamento"
                  value={form.watch('og_image_url')}
                  onChange={(url) => form.setValue('og_image_url', url)}
                />
              </TabsContent>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- Configuracoes.test`
Expected: PASS (12 testes)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: aba SEO

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Aba "Redes sociais e tracking"

**Files:**
- Modify: `src/pages/Configuracoes.tsx`
- Modify: `src/pages/Configuracoes.test.tsx`

- [ ] **Step 1: Adicionar o teste (falhando)**

Em `src/pages/Configuracoes.test.tsx`, adicionar:

```tsx
  it('edita e salva redes sociais e tracking', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /redes sociais/i }))
    await usuario.type(screen.getByLabelText(/instagram/i), 'https://instagram.com/autocentersilva')
    await usuario.type(screen.getByLabelText(/meta pixel/i), '123456789')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        instagram_url: 'https://instagram.com/autocentersilva',
        meta_pixel_id: '123456789',
      })
    )
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Configuracoes.test`
Expected: FAIL (não existe aba "Redes sociais")

- [ ] **Step 3: Implementar a aba**

Em `src/pages/Configuracoes.tsx`, adicionar o `TabsTrigger`:

```tsx
                <TabsTrigger value="social">Redes sociais</TabsTrigger>
```

E o `TabsContent`, depois do `TabsContent value="seo"`:

```tsx
              <TabsContent value="social" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="instagram_url">Instagram</Label>
                  <Input id="instagram_url" {...form.register('instagram_url')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="facebook_url">Facebook</Label>
                  <Input id="facebook_url" {...form.register('facebook_url')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tiktok_url">TikTok</Label>
                  <Input id="tiktok_url" {...form.register('tiktok_url')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="youtube_url">YouTube</Label>
                  <Input id="youtube_url" {...form.register('youtube_url')} />
                </div>

                <p className="text-sm font-medium">Tracking</p>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="meta_pixel_id">Meta Pixel ID</Label>
                  <Input id="meta_pixel_id" {...form.register('meta_pixel_id')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="google_tag_id">Google Tag ID</Label>
                  <Input id="google_tag_id" {...form.register('google_tag_id')} />
                </div>
              </TabsContent>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- Configuracoes.test`
Expected: PASS (13 testes)

- [ ] **Step 5: Verificação manual completa**

Run: `npm run dev`, acessar `/configuracoes` e percorrer todas as 8 abas, preenchendo pelo menos um campo em cada uma, salvar, e confirmar no Supabase (Table Editor → `lojas`) que todos os valores foram gravados corretamente — incluindo `vitrine_destaque_tipo = 'imagem'` se uma imagem de destaque foi enviada.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: aba Redes sociais e tracking

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Revisão final e atualização do roteiro

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rodar a suite completa de testes**

Run: `npm test`
Expected: PASS (todos os testes do projeto, incluindo os de Configurações e os já existentes do CRUD de veículos)

- [ ] **Step 2: Checar tipos**

Run: `npx tsc -b`
Expected: sem erros

- [ ] **Step 3: Checklist de verificação manual final**

- [ ] Carregar `/configuracoes` numa loja sem nenhum dado extra preenchido (só `nome_loja`) — nenhuma aba deve quebrar ou mostrar erro.
- [ ] Preencher e salvar cada uma das 8 abas, recarregar a página (F5) e confirmar que todos os valores persistiram.
- [ ] Tentar salvar um slug que já pertence a outra loja (criar uma segunda loja de teste, se necessário) e confirmar a mensagem de erro no campo.
- [ ] Confirmar visualmente que trocar a logo remove a imagem antiga do bucket `lojas-imagens` no Supabase (Storage → verificar que não sobra arquivo órfão do teste anterior).

- [ ] **Step 4: Atualizar o roteiro no CLAUDE.md**

Em `CLAUDE.md`, marcar o item 3a como completo e adicionar a referência ao plano:

```markdown
Plano de implementação de Configurações da loja: `docs/superpowers/plans/2026-09-14-configuracoes-loja.md`
```

E trocar:

```markdown
   - 3a. **Configurações da loja** — próximo. Tela `/configuracoes` para editar todos os dados cadastrais da loja (identidade, endereço, horários, aparência, textos/imagem da vitrine, SEO, redes sociais, tracking).
```

por:

```markdown
   - 3a. ~~Configurações da loja~~ ✅ completo.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: marca Configurações da loja (3a) como completo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
