import { describe, it, expect } from 'vitest'
import { decidirMovimentoLead } from './decidirMovimentoLead'

describe('decidirMovimentoLead', () => {
  it('retorna a coluna de destino quando é diferente da atual', () => {
    expect(decidirMovimentoLead({ id: 'Quente' }, 'Frio')).toBe('Quente')
  })

  it('retorna null quando não há coluna de destino (drop fora de qualquer coluna)', () => {
    expect(decidirMovimentoLead(null, 'Frio')).toBeNull()
  })

  it('retorna null quando o destino é a coluna "Novo" (bloqueado)', () => {
    expect(decidirMovimentoLead({ id: 'novo' }, 'Frio')).toBeNull()
  })

  it('retorna null quando o destino é a mesma coluna atual (no-op)', () => {
    expect(decidirMovimentoLead({ id: 'Frio' }, 'Frio')).toBeNull()
  })
})
