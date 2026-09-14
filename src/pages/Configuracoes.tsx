import { useLayoutEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useLoja } from '@/hooks/useLoja'
import { lojaSchema, type LojaFormValues } from '@/lib/loja-schema'
import { updateLoja, type LojaPayload } from '@/lib/loja'
import { CorField } from '@/components/loja/CorField'
import { ImagemField } from '@/components/loja/ImagemField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'

const ERRO_SLUG_DUPLICADO = 'Esse endereço já está em uso, escolha outro.'

const valoresIniciais: z.input<typeof lojaSchema> = {
  nome_loja: '',
  descricao: undefined,
  telefone_contato: undefined,
  email_contato: undefined,
  logradouro: undefined,
  numero: undefined,
  bairro: undefined,
  cidade: undefined,
  estado: undefined,
  cep: undefined,
  google_maps_link: undefined,
  horario_semana_abertura: undefined,
  horario_semana_fechamento: undefined,
  horario_sabado_abertura: undefined,
  horario_sabado_fechamento: undefined,
  horario_domingo_abertura: undefined,
  horario_domingo_fechamento: undefined,
  logo_url: undefined,
  banner_url: undefined,
  cor_primaria: undefined,
  cor_secundaria: undefined,
  slug: undefined,
  vitrine_headline: undefined,
  vitrine_subheadline: undefined,
  vitrine_cta_texto: undefined,
  vitrine_cta_destino: undefined,
  vitrine_destaque_url: undefined,
  meta_titulo: undefined,
  meta_descricao: undefined,
  og_image_url: undefined,
  instagram_url: undefined,
  facebook_url: undefined,
  tiktok_url: undefined,
  youtube_url: undefined,
  meta_pixel_id: undefined,
  google_tag_id: undefined,
}

export default function ConfiguracoesPage() {
  const { user } = useAuth()
  const { loja, carregando, erro, recarregar } = useLoja(user?.id)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  const form = useForm<z.input<typeof lojaSchema>, unknown, z.output<typeof lojaSchema>>({
    resolver: zodResolver(lojaSchema),
    defaultValues: valoresIniciais,
  })

  useLayoutEffect(() => {
    if (!loja) return
    form.reset({
      nome_loja: loja.nome_loja ?? '',
      descricao: loja.descricao ?? undefined,
      telefone_contato: loja.telefone_contato ?? undefined,
      email_contato: loja.email_contato ?? undefined,
      logradouro: loja.logradouro ?? undefined,
      numero: loja.numero ?? undefined,
      bairro: loja.bairro ?? undefined,
      cidade: loja.cidade ?? undefined,
      estado: loja.estado ?? undefined,
      cep: loja.cep ?? undefined,
      google_maps_link: loja.google_maps_link ?? undefined,
      horario_semana_abertura: loja.horario_semana_abertura ?? undefined,
      horario_semana_fechamento: loja.horario_semana_fechamento ?? undefined,
      horario_sabado_abertura: loja.horario_sabado_abertura ?? undefined,
      horario_sabado_fechamento: loja.horario_sabado_fechamento ?? undefined,
      horario_domingo_abertura: loja.horario_domingo_abertura ?? undefined,
      horario_domingo_fechamento: loja.horario_domingo_fechamento ?? undefined,
      logo_url: loja.logo_url ?? undefined,
      banner_url: loja.banner_url ?? undefined,
      cor_primaria: loja.cor_primaria ?? undefined,
      cor_secundaria: loja.cor_secundaria ?? undefined,
      slug: loja.slug ?? undefined,
      vitrine_headline: loja.vitrine_headline ?? undefined,
      vitrine_subheadline: loja.vitrine_subheadline ?? undefined,
      vitrine_cta_texto: loja.vitrine_cta_texto ?? undefined,
      vitrine_cta_destino: loja.vitrine_cta_destino ?? undefined,
      vitrine_destaque_url: loja.vitrine_destaque_url ?? undefined,
      meta_titulo: loja.meta_titulo ?? undefined,
      meta_descricao: loja.meta_descricao ?? undefined,
      og_image_url: loja.og_image_url ?? undefined,
      instagram_url: loja.instagram_url ?? undefined,
      facebook_url: loja.facebook_url ?? undefined,
      tiktok_url: loja.tiktok_url ?? undefined,
      youtube_url: loja.youtube_url ?? undefined,
      meta_pixel_id: loja.meta_pixel_id ?? undefined,
      google_tag_id: loja.google_tag_id ?? undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loja])

  if (!user || carregando) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  if (erro) {
    return (
      <div className="flex flex-col items-start gap-2 p-4">
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
    return <p className="text-muted-foreground">Loja não encontrada. Contate o suporte.</p>
  }

  async function onSubmit(valores: LojaFormValues) {
    setErroSalvar(null)
    setSalvo(false)
    setSalvando(true)

    const payload: LojaPayload = {
      nome_loja: valores.nome_loja,
      descricao: valores.descricao ?? null,
      telefone_contato: valores.telefone_contato ?? null,
      email_contato: valores.email_contato ?? null,
      logradouro: valores.logradouro ?? null,
      numero: valores.numero ?? null,
      bairro: valores.bairro ?? null,
      cidade: valores.cidade ?? null,
      estado: valores.estado ?? null,
      cep: valores.cep ?? null,
      google_maps_link: valores.google_maps_link ?? null,
      horario_semana_abertura: valores.horario_semana_abertura ?? null,
      horario_semana_fechamento: valores.horario_semana_fechamento ?? null,
      horario_sabado_abertura: valores.horario_sabado_abertura ?? null,
      horario_sabado_fechamento: valores.horario_sabado_fechamento ?? null,
      horario_domingo_abertura: valores.horario_domingo_abertura ?? null,
      horario_domingo_fechamento: valores.horario_domingo_fechamento ?? null,
      logo_url: valores.logo_url ?? null,
      banner_url: valores.banner_url ?? null,
      cor_primaria: valores.cor_primaria ?? null,
      cor_secundaria: valores.cor_secundaria ?? null,
      slug: valores.slug ?? null,
      vitrine_headline: valores.vitrine_headline ?? null,
      vitrine_subheadline: valores.vitrine_subheadline ?? null,
      vitrine_cta_texto: valores.vitrine_cta_texto ?? null,
      vitrine_cta_destino: valores.vitrine_cta_destino ?? null,
      vitrine_destaque_url: valores.vitrine_destaque_url ?? null,
      vitrine_destaque_tipo: valores.vitrine_destaque_url ? 'imagem' : null,
      meta_titulo: valores.meta_titulo ?? null,
      meta_descricao: valores.meta_descricao ?? null,
      og_image_url: valores.og_image_url ?? null,
      instagram_url: valores.instagram_url ?? null,
      facebook_url: valores.facebook_url ?? null,
      tiktok_url: valores.tiktok_url ?? null,
      youtube_url: valores.youtube_url ?? null,
      meta_pixel_id: valores.meta_pixel_id ?? null,
      google_tag_id: valores.google_tag_id ?? null,
    }

    try {
      await updateLoja(user!.id, payload)
      setSalvo(true)
    } catch (e) {
      const mensagem = (e as Error).message
      if (mensagem === ERRO_SLUG_DUPLICADO) {
        form.setError('slug', { type: 'manual', message: mensagem })
      } else {
        setErroSalvar(mensagem)
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Configurações da loja</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit, () => setSalvo(false))}
            className="flex flex-col gap-4"
          >
            <Tabs defaultValue="basico">
              <TabsList>
                <TabsTrigger value="basico">Dados básicos</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="aparencia">Aparência</TabsTrigger>
              </TabsList>

              <TabsContent value="basico" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nome_loja">Nome da loja</Label>
                  <Input id="nome_loja" {...form.register('nome_loja')} />
                  {form.formState.errors.nome_loja && (
                    <p role="alert" className="text-sm text-destructive">
                      {form.formState.errors.nome_loja.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input id="descricao" {...form.register('descricao')} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="telefone_contato">Telefone / WhatsApp</Label>
                  <Input id="telefone_contato" {...form.register('telefone_contato')} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email_contato">E-mail de contato</Label>
                  <Input id="email_contato" {...form.register('email_contato')} />
                  {form.formState.errors.email_contato && (
                    <p role="alert" className="text-sm text-destructive">
                      {form.formState.errors.email_contato.message}
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="endereco" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input id="logradouro" {...form.register('logradouro')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" {...form.register('numero')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" {...form.register('bairro')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" {...form.register('cidade')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input id="estado" {...form.register('estado')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input id="cep" {...form.register('cep')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="google_maps_link">Link do Google Maps</Label>
                  <Input id="google_maps_link" {...form.register('google_maps_link')} />
                </div>

                <p className="text-sm font-medium">Horário de funcionamento</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_semana_abertura">Seg-sex, abertura</Label>
                    <Input id="horario_semana_abertura" type="time" {...form.register('horario_semana_abertura')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_semana_fechamento">Seg-sex, fechamento</Label>
                    <Input id="horario_semana_fechamento" type="time" {...form.register('horario_semana_fechamento')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_sabado_abertura">Sábado, abertura</Label>
                    <Input id="horario_sabado_abertura" type="time" {...form.register('horario_sabado_abertura')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_sabado_fechamento">Sábado, fechamento</Label>
                    <Input id="horario_sabado_fechamento" type="time" {...form.register('horario_sabado_fechamento')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_domingo_abertura">Domingo, abertura</Label>
                    <Input id="horario_domingo_abertura" type="time" {...form.register('horario_domingo_abertura')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="horario_domingo_fechamento">Domingo, fechamento</Label>
                    <Input id="horario_domingo_fechamento" type="time" {...form.register('horario_domingo_fechamento')} />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Deixe os dois campos de um dia em branco se a loja não abre nesse dia.</p>
              </TabsContent>

              <TabsContent value="aparencia" className="flex flex-col gap-4">
                <ImagemField
                  lojaId={user!.id}
                  campo="logo"
                  label="Logo"
                  value={form.watch('logo_url') as string | undefined}
                  onChange={(url) => form.setValue('logo_url', url)}
                />
                <ImagemField
                  lojaId={user!.id}
                  campo="banner"
                  label="Banner"
                  value={form.watch('banner_url') as string | undefined}
                  onChange={(url) => form.setValue('banner_url', url)}
                />
                <CorField
                  id="cor_primaria"
                  label="Cor primária"
                  value={form.watch('cor_primaria') as string | undefined}
                  onChange={(valor) => form.setValue('cor_primaria', valor)}
                />
                <CorField
                  id="cor_secundaria"
                  label="Cor secundária"
                  value={form.watch('cor_secundaria') as string | undefined}
                  onChange={(valor) => form.setValue('cor_secundaria', valor)}
                />
              </TabsContent>
            </Tabs>

            {erroSalvar && (
              <p role="alert" className="text-sm text-destructive">
                {erroSalvar}
              </p>
            )}
            {salvo && (
              <p role="status" className="text-sm text-muted-foreground">
                Alterações salvas.
              </p>
            )}

            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
