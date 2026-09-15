import { describe, it, expect } from 'vitest'
import { mapearEventoAsaas } from './asaas-webhook'

describe('mapearEventoAsaas', () => {
  it.each([
    ['PAYMENT_CONFIRMED', 'active'],
    ['PAYMENT_RECEIVED', 'active'],
    ['PAYMENT_OVERDUE', 'overdue'],
    ['PAYMENT_DELETED', 'canceled'],
    ['PAYMENT_REFUNDED', 'canceled'],
  ] as const)('mapeia %s para %s', (evento, esperado) => {
    expect(mapearEventoAsaas(evento)).toBe(esperado)
  })

  it('retorna null para eventos que não afetam o status da assinatura', () => {
    expect(mapearEventoAsaas('PAYMENT_CREATED')).toBeNull()
    expect(mapearEventoAsaas('PAYMENT_UPDATED')).toBeNull()
    expect(mapearEventoAsaas('algo-desconhecido')).toBeNull()
  })
})
