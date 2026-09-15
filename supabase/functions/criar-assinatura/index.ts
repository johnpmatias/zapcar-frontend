import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'

const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') ?? 'https://api-sandbox.asaas.com/v3'
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!
const PRECO_MENSAL_REAIS = 97

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers: corsHeaders })
    }

    const { data: loja, error: lojaError } = await supabase
      .from('lojas')
      .select('id, nome_loja, email_contato, asaas_customer_id, asaas_subscription_id')
      .eq('user_id', userData.user.id)
      .single()

    if (lojaError || !loja) {
      return new Response(JSON.stringify({ error: 'Loja não encontrada.' }), { status: 404, headers: corsHeaders })
    }

    let asaasCustomerId = loja.asaas_customer_id as string | null

    if (!asaasCustomerId) {
      const clienteResposta = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
        body: JSON.stringify({
          name: loja.nome_loja ?? 'Loja ZapCar',
          email: loja.email_contato ?? userData.user.email,
        }),
      })
      const cliente = await clienteResposta.json()
      if (!clienteResposta.ok) {
        return new Response(
          JSON.stringify({ error: cliente.errors?.[0]?.description ?? 'Erro ao criar cliente no Asaas.' }),
          { status: 502, headers: corsHeaders }
        )
      }
      asaasCustomerId = cliente.id

      // Persist customer ID immediately to avoid orphaning on retry
      await supabase.from('lojas').update({ asaas_customer_id: asaasCustomerId }).eq('id', loja.id)
    }

    let asaasSubscriptionId = loja.asaas_subscription_id as string | null
    let assinatura: { id: string; errors?: Array<{ description: string }> }

    if (!asaasSubscriptionId) {
      const assinaturaResposta = await fetch(`${ASAAS_API_URL}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: 'UNDEFINED',
          cycle: 'MONTHLY',
          value: PRECO_MENSAL_REAIS,
          description: 'Assinatura ZapCar',
        }),
      })
      assinatura = await assinaturaResposta.json()
      if (!assinaturaResposta.ok) {
        return new Response(
          JSON.stringify({ error: assinatura.errors?.[0]?.description ?? 'Erro ao criar assinatura no Asaas.' }),
          { status: 502, headers: corsHeaders }
        )
      }
      asaasSubscriptionId = assinatura.id
    } else {
      assinatura = { id: asaasSubscriptionId }
    }

    // A assinatura gera a primeira cobrança de forma assíncrona no Asaas —
    // busca essa cobrança pra obter o link de pagamento hospedado (invoiceUrl
    // é um campo da cobrança, não da assinatura).
    const cobrancasResposta = await fetch(
      `${ASAAS_API_URL}/payments?subscription=${assinatura.id}&limit=1`,
      { headers: { access_token: ASAAS_API_KEY } }
    )
    const cobrancas = await cobrancasResposta.json()
    if (!cobrancasResposta.ok) {
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar a cobrança gerada.' }),
        { status: 502, headers: corsHeaders }
      )
    }
    const linkPagamento = cobrancas.data?.[0]?.invoiceUrl

    if (!linkPagamento) {
      return new Response(
        JSON.stringify({
          error: 'Assinatura criada, mas o link de pagamento ainda não está disponível. Tente novamente em instantes.',
        }),
        { status: 502, headers: corsHeaders }
      )
    }

    await supabase
      .from('lojas')
      .update({ asaas_customer_id: asaasCustomerId, asaas_subscription_id: assinatura.id })
      .eq('id', loja.id)

    return new Response(JSON.stringify({ linkPagamento }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders })
  }
})
