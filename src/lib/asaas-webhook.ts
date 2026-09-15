export type StatusAssinaturaWebhook = 'active' | 'overdue' | 'canceled'

/**
 * Mapeia o campo `event` do payload de webhook do Asaas para o
 * `subscription_status` correspondente em `lojas`. Retorna null para
 * eventos que não afetam a assinatura (ex.: PAYMENT_CREATED) — nesse
 * caso quem chama esta função não deve alterar nada no banco.
 *
 * Zero dependências de runtime (sem imports do Supabase ou do Deno) de
 * propósito: este arquivo é importado tanto pelos testes deste projeto
 * (Vitest/Node) quanto pela Edge Function `webhook-asaas` (Deno), e
 * precisa rodar identicamente nos dois.
 */
export function mapearEventoAsaas(evento: string): StatusAssinaturaWebhook | null {
  switch (evento) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return 'active'
    case 'PAYMENT_OVERDUE':
      return 'overdue'
    case 'PAYMENT_DELETED':
    case 'PAYMENT_REFUNDED':
      return 'canceled'
    default:
      return null
  }
}
