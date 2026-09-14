import { z } from 'zod'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/
const COR_REGEX = /^#[0-9a-fA-F]{6}$/
const URL_REGEX = /^(https?:\/\/)?[^\s]+\.[^\s]+$/

const paraIndefinidoSeVazio = (valor: unknown) =>
  valor === '' || valor === null || valor === undefined ? undefined : valor

const textoOpcional = () => z.preprocess(paraIndefinidoSeVazio, z.string().trim().optional())

const emailOpcional = () =>
  z.preprocess(
    paraIndefinidoSeVazio,
    z.string().trim().regex(EMAIL_REGEX, 'E-mail inválido.').optional()
  )

const corOpcional = () =>
  z.preprocess(
    paraIndefinidoSeVazio,
    z.string().trim().regex(COR_REGEX, 'Cor inválida. Use o formato #RRGGBB.').optional()
  )

const urlOpcional = () =>
  z.preprocess(
    paraIndefinidoSeVazio,
    z.string().trim().regex(URL_REGEX, 'URL inválida.').optional()
  )

const slugOpcional = () =>
  z.preprocess(
    (valor) => {
      const semVazio = paraIndefinidoSeVazio(valor)
      return semVazio === undefined ? undefined : String(semVazio).trim().toLowerCase()
    },
    z.string().regex(SLUG_REGEX, 'Use apenas letras minúsculas, números e hífen.').optional()
  )

export const lojaSchema = z.object({
  nome_loja: z.coerce.string().trim().min(1, 'Informe o nome da loja.'),
  descricao: textoOpcional(),
  telefone_contato: textoOpcional(),
  email_contato: emailOpcional(),
  logradouro: textoOpcional(),
  numero: textoOpcional(),
  bairro: textoOpcional(),
  cidade: textoOpcional(),
  estado: textoOpcional(),
  cep: textoOpcional(),
  google_maps_link: textoOpcional(),
  horario_semana_abertura: textoOpcional(),
  horario_semana_fechamento: textoOpcional(),
  horario_sabado_abertura: textoOpcional(),
  horario_sabado_fechamento: textoOpcional(),
  horario_domingo_abertura: textoOpcional(),
  horario_domingo_fechamento: textoOpcional(),
  logo_url: textoOpcional(),
  banner_url: textoOpcional(),
  cor_primaria: corOpcional(),
  cor_secundaria: corOpcional(),
  slug: slugOpcional(),
  vitrine_headline: textoOpcional(),
  vitrine_subheadline: textoOpcional(),
  vitrine_cta_texto: textoOpcional(),
  vitrine_cta_destino: textoOpcional(),
  vitrine_destaque_url: textoOpcional(),
  meta_titulo: textoOpcional(),
  meta_descricao: textoOpcional(),
  og_image_url: textoOpcional(),
  instagram_url: urlOpcional(),
  facebook_url: urlOpcional(),
  tiktok_url: urlOpcional(),
  youtube_url: urlOpcional(),
  meta_pixel_id: textoOpcional(),
  google_tag_id: textoOpcional(),
})

export type LojaFormValues = z.infer<typeof lojaSchema>
