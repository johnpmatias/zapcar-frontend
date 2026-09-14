import { supabase } from '@/lib/supabase'

const BUCKET = 'veiculos-fotos'

export async function uploadFotoVeiculo(lojaId: string, veiculoId: string, arquivo: File): Promise<string> {
  const extensao = arquivo.name.split('.').pop() ?? 'jpg'
  const caminho = `${lojaId}/${veiculoId}/${crypto.randomUUID()}.${extensao}`

  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho)
  return data.publicUrl
}

export async function removerFotoVeiculo(url: string): Promise<void> {
  const marcador = `/storage/v1/object/public/${BUCKET}/`
  const indice = url.indexOf(marcador)
  if (indice === -1) return

  const caminho = decodeURIComponent(url.slice(indice + marcador.length))
  const { error } = await supabase.storage.from(BUCKET).remove([caminho])
  if (error) throw new Error(error.message)
}
