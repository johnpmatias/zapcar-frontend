import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { mapearEventoAsaas } from '../../../src/lib/asaas-webhook.ts'

const ASAAS_WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN')!

Deno.serve(async (req) => {
  if (req.headers.get('asaas-access-token') !== ASAAS_WEBHOOK_TOKEN) {
    return new Response('Não autorizado.', { status: 401 })
  }

  const payload = await req.json()
  const novoStatus = mapearEventoAsaas(payload.event)

  if (!novoStatus) {
    return new Response('ok', { status: 200 })
  }

  const asaasSubscriptionId = payload.payment?.subscription
  if (!asaasSubscriptionId) {
    return new Response('ok', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabase
    .from('lojas')
    .update({ subscription_status: novoStatus })
    .eq('asaas_subscription_id', asaasSubscriptionId)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response('ok', { status: 200 })
})
