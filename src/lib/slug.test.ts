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
