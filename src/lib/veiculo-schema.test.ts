import { describe, it, expect } from 'vitest'
import { veiculoSchema } from '@/lib/veiculo-schema'

const dadosValidosMinimos = {
  marca: 'Honda',
  modelo: 'Civic',
  ano_fabricacao: '2023',
  ano_modelo: '2024',
  preco: '95000',
}

describe('veiculoSchema', () => {
  it('aceita os campos mínimos obrigatórios', () => {
    const resultado = veiculoSchema.safeParse(dadosValidosMinimos)
    expect(resultado.success).toBe(true)
  })

  it('rejeita quando falta a marca', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, marca: '' })
    expect(resultado.success).toBe(false)
  })

  it('rejeita preço zero ou negativo', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, preco: '0' })
    expect(resultado.success).toBe(false)
  })

  it('trata km vazio como não informado, sem erro', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, km: '' })
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.km).toBeUndefined()
    }
  })

  it('rejeita preço promocional maior ou igual ao preço normal', () => {
    const resultado = veiculoSchema.safeParse({
      ...dadosValidosMinimos,
      preco: '90000',
      preco_promocional: '90000',
    })
    expect(resultado.success).toBe(false)
  })

  it('aceita preço promocional menor que o preço normal', () => {
    const resultado = veiculoSchema.safeParse({
      ...dadosValidosMinimos,
      preco: '90000',
      preco_promocional: '85000',
    })
    expect(resultado.success).toBe(true)
  })

  it('normaliza a placa para maiúsculas e valida o formato', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, placa: 'abc1d23' })
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.placa).toBe('ABC1D23')
    }
  })

  it('rejeita placa em formato inválido', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, placa: '12345' })
    expect(resultado.success).toBe(false)
  })

  it('aplica os defaults de aceita_troca, destaque, opcionais e status', () => {
    const resultado = veiculoSchema.safeParse(dadosValidosMinimos)
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.aceita_troca).toBe(false)
      expect(resultado.data.destaque).toBe(false)
      expect(resultado.data.opcionais).toEqual([])
      expect(resultado.data.status).toBe('disponivel')
    }
  })
})
