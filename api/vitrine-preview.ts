import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface DadosPreview {
  nomeLoja: string | null
  headline: string | null
  metaTitulo: string | null
  metaDescricao: string | null
  ogImageUrl: string | null
}

const BOTS_DE_PREVIEW =
  /facebookexternalhit|WhatsApp|Twitterbot|Slackbot|LinkedInBot|TelegramBot|Discordbot/i

export function ehBotDePreview(userAgent: string | undefined): boolean {
  if (!userAgent) return false
  return BOTS_DE_PREVIEW.test(userAgent)
}

interface LinhaLojaPreview {
  nome_loja: string | null
  vitrine_headline: string | null
  meta_titulo: string | null
  meta_descricao: string | null
  og_image_url: string | null
}

export async function buscarDadosPreview(
  slug: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<DadosPreview | null> {
  const colunas = 'nome_loja,vitrine_headline,meta_titulo,meta_descricao,og_image_url'
  const url =
    `${supabaseUrl}/rest/v1/lojas?select=${colunas}` +
    `&slug=eq.${encodeURIComponent(slug)}&vitrine_publica=eq.true&limit=1`

  const resposta = await fetch(url, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  if (!resposta.ok) return null

  const linhas = (await resposta.json()) as LinhaLojaPreview[]
  const loja = linhas[0]
  if (!loja) return null

  return {
    nomeLoja: loja.nome_loja,
    headline: loja.vitrine_headline,
    metaTitulo: loja.meta_titulo,
    metaDescricao: loja.meta_descricao,
    ogImageUrl: loja.og_image_url,
  }
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function montarHtmlPreview(dados: DadosPreview | null): string {
  const titulo = escaparHtml(dados?.metaTitulo || dados?.nomeLoja || 'Vitrine ZapCar')
  const descricao = escaparHtml(dados?.metaDescricao || dados?.headline || '')
  const imagem = dados?.ogImageUrl ? escaparHtml(dados.ogImageUrl) : null

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>${titulo}</title>
    <meta property="og:title" content="${titulo}" />
    <meta property="og:description" content="${descricao}" />
    ${imagem ? `<meta property="og:image" content="${imagem}" />` : ''}
  </head>
  <body></body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug
  const userAgent = req.headers['user-agent']

  if (typeof slug !== 'string' || !ehBotDePreview(userAgent)) {
    res.status(404).end()
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

  const dados = supabaseUrl && supabaseKey ? await buscarDadosPreview(slug, supabaseUrl, supabaseKey) : null

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(montarHtmlPreview(dados))
}
