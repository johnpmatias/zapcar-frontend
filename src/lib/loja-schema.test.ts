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

  it('rejeita instagram_url em formato inválido', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, instagram_url: 'not a url' })
    expect(resultado.success).toBe(false)
  })

  it('aceita instagram_url com esquema http(s)', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, instagram_url: 'https://instagram.com/lojaX' })
    expect(resultado.success).toBe(true)
  })

  it('aceita instagram_url sem esquema http(s)', () => {
    const resultado = lojaSchema.safeParse({ ...dadosMinimos, instagram_url: 'instagram.com/lojaX' })
    expect(resultado.success).toBe(true)
  })

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
})
