import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'

const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL')!
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CobrancaAsaas {
  id: string
  value: number
  status: string
  dueDate: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: loja } = await supabase
      .from('lojas')
      .select('asaas_customer_id')
      .eq('user_id', userData.user.id)
      .single()

    if (!loja?.asaas_customer_id) {
      return new Response(JSON.stringify({ cobrancas: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cobrancasResposta = await fetch(
      `${ASAAS_API_URL}/payments?customer=${loja.asaas_customer_id}&order=desc`,
      { headers: { access_token: ASAAS_API_KEY } }
    )

    if (!cobrancasResposta.ok) {
      return new Response(JSON.stringify({ error: 'Erro ao consultar cobranças no Asaas.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cobrancas = await cobrancasResposta.json()

    const resultado = ((cobrancas.data ?? []) as CobrancaAsaas[]).map((c) => ({
      id: c.id,
      valor: c.value,
      status: c.status,
      vencimento: c.dueDate,
    }))

    return new Response(JSON.stringify({ cobrancas: resultado }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
