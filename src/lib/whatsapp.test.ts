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
