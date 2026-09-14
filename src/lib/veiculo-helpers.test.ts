import { describe, it, expect } from 'vitest'
import { gerarTitulo, derivarPlacaFinal } from '@/lib/veiculo-helpers'

describe('gerarTitulo', () => {
  it('combina marca, modelo e ano do modelo', () => {
    expect(gerarTitulo('Honda', 'Civic', 2024)).toBe('Honda Civic 2024')
  })
})

describe('derivarPlacaFinal', () => {
  it('retorna os últimos 4 caracteres da placa', () => {
    expect(derivarPlacaFinal('ABC1D23')).toBe('1D23')
  })

  it('retorna null quando não há placa', () => {
    expect(derivarPlacaFinal(null)).toBeNull()
    expect(derivarPlacaFinal(undefined)).toBeNull()
  })
})
