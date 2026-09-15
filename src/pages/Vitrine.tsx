import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useVitrine } from '@/hooks/useVitrine'
import { formatarNumeroWhatsapp, montarLinkWhatsapp } from '@/lib/whatsapp'
import { injetarGoogleTag, injetarMetaPixel } from '@/lib/tracking'
import { CardVeiculo } from '@/components/vitrine/CardVeiculo'
import { Button } from '@/components/ui/button'
import { ehUrlSegura, type LojaPublica } from '@/lib/vitrine'

const DIAS_HORARIO: { abertura: keyof LojaPublica; fechamento: keyof LojaPublica; label: string }[] = [
  { abertura: 'horario_semana_abertura', fechamento: 'horario_semana_fechamento', label: 'Seg-sex' },
  { abertura: 'horario_sabado_abertura', fechamento: 'horario_sabado_fechamento', label: 'Sábado' },
  { abertura: 'horario_domingo_abertura', fechamento: 'horario_domingo_fechamento', label: 'Domingo' },
]

const REDES_SOCIAIS: { campo: keyof LojaPublica; label: string }[] = [
  { campo: 'instagram_url', label: 'Instagram' },
  { campo: 'facebook_url', label: 'Facebook' },
  { campo: 'tiktok_url', label: 'TikTok' },
  { campo: 'youtube_url', label: 'YouTube' },
]

function formatarHorario(loja: LojaPublica, dia: (typeof DIAS_HORARIO)[number]): string {
  const abertura = loja[dia.abertura] as string | null
  const fechamento = loja[dia.fechamento] as string | null
  if (!abertura || !fechamento) return `${dia.label}: Fechado`
  return `${dia.label}: ${abertura}–${fechamento}`
}

function temEndereco(loja: LojaPublica): boolean {
  return Boolean(loja.logradouro || loja.numero || loja.bairro || loja.cidade || loja.estado)
}

export default function VitrinePage() {
  const { slug } = useParams<{ slug: string }>()
  const { loja, veiculos, carregando, erro, recarregar } = useVitrine(slug ?? '')

  useEffect(() => {
    if (!loja?.meta_pixel_id) return
    return injetarMetaPixel(loja.meta_pixel_id)
  }, [loja?.meta_pixel_id])

  useEffect(() => {
    if (!loja?.google_tag_id) return
    return injetarGoogleTag(loja.google_tag_id)
  }, [loja?.google_tag_id])

  if (carregando) {
    return <p className="p-8 text-center text-muted-foreground">Carregando...</p>
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-2 p-8">
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
        <Button variant="outline" onClick={recarregar}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!loja) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Vitrine não encontrada.</p>
      </div>
    )
  }

  const numeroWhatsapp = formatarNumeroWhatsapp(loja.telefone_contato)
  const ctaDestinoSeguro = ehUrlSegura(loja.vitrine_cta_destino) ? loja.vitrine_cta_destino : null
  const linkCtaGeral =
    ctaDestinoSeguro ||
    (numeroWhatsapp
      ? montarLinkWhatsapp(numeroWhatsapp, 'Olá! Vi a vitrine e gostaria de mais informações.')
      : null)
  const linkMapaSeguro = ehUrlSegura(loja.google_maps_link) ? loja.google_maps_link : null

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="flex flex-col items-center gap-3 px-4 py-10 text-center text-white"
        style={{
          background: loja.banner_url
            ? `center / cover no-repeat url(${loja.banner_url})`
            : `linear-gradient(135deg, ${loja.cor_primaria ?? '#1e3a5f'}, ${loja.cor_secundaria ?? '#2d5f8a'})`,
        }}
      >
        {loja.logo_url && (
          <img src={loja.logo_url} alt={loja.nome_loja ?? ''} className="size-14 rounded-md object-cover" />
        )}
        <h1 className="text-2xl font-semibold">{loja.nome_loja}</h1>
        {loja.vitrine_headline && <p className="text-lg">{loja.vitrine_headline}</p>}
        {loja.vitrine_subheadline && <p className="text-sm opacity-90">{loja.vitrine_subheadline}</p>}
        {linkCtaGeral && (
          <Button onClick={() => window.open(linkCtaGeral, '_blank')}>
            {loja.vitrine_cta_texto || 'Fale com a gente'}
          </Button>
        )}
      </header>

      <main className="flex-1 px-4 py-8">
        {veiculos.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Nenhum veículo disponível no momento. Fale com a gente!
          </p>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {veiculos.map((veiculo) => (
              <CardVeiculo key={veiculo.id} veiculo={veiculo} numeroWhatsapp={numeroWhatsapp} />
            ))}
          </div>
        )}
      </main>

      <footer className="flex flex-col items-center gap-2 border-t px-4 py-6 text-center text-sm text-muted-foreground">
        {temEndereco(loja) && (
          <p>
            {[loja.logradouro, loja.numero, loja.bairro, loja.cidade, loja.estado].filter(Boolean).join(', ')}
            {linkMapaSeguro && (
              <>
                {' · '}
                <a href={linkMapaSeguro} target="_blank" rel="noreferrer" className="underline">
                  Ver no mapa
                </a>
              </>
            )}
          </p>
        )}
        <div className="flex flex-col">
          {DIAS_HORARIO.map((dia) => (
            <span key={dia.label}>{formatarHorario(loja, dia)}</span>
          ))}
        </div>
        <div className="flex gap-3">
          {REDES_SOCIAIS.filter((rede) => ehUrlSegura(loja[rede.campo] as string | null)).map((rede) => (
            <a
              key={rede.campo}
              href={loja[rede.campo] as string}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {rede.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}
