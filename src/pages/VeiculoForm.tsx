import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import {
  veiculoSchema,
  type VeiculoFormValues,
  COMBUSTIVEL_OPTIONS,
  CAMBIO_OPTIONS,
  CARROCERIA_OPTIONS,
  STATUS_OPTIONS,
} from '@/lib/veiculo-schema'
import { gerarTitulo, derivarPlacaFinal } from '@/lib/veiculo-helpers'
import { createVeiculo, getVeiculo, updateVeiculo, type VeiculoPayload } from '@/lib/veiculos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { OpcionaisField } from '@/components/veiculos/OpcionaisField'

const valoresIniciais: z.input<typeof veiculoSchema> = {
  marca: '',
  modelo: '',
  versao: undefined,
  ano_fabricacao: new Date().getFullYear(),
  ano_modelo: new Date().getFullYear(),
  cor: undefined,
  km: undefined,
  combustivel: undefined,
  cambio: undefined,
  carroceria: undefined,
  portas: undefined,
  placa: undefined,
  preco: 0,
  preco_promocional: undefined,
  aceita_troca: false,
  destaque: false,
  descricao: undefined,
  opcionais: [],
  status: 'disponivel',
}

export default function VeiculoFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [veiculoId] = useState(() => id ?? crypto.randomUUID())

  const form = useForm<z.input<typeof veiculoSchema>, unknown, z.output<typeof veiculoSchema>>({
    resolver: zodResolver(veiculoSchema),
    defaultValues: valoresIniciais,
  })

  const [carregandoVeiculo, setCarregandoVeiculo] = useState(Boolean(id))
  const [naoEncontrado, setNaoEncontrado] = useState(false)

  useEffect(() => {
    if (!id) return
    getVeiculo(id)
      .then((veiculo) => {
        if (!veiculo) {
          setNaoEncontrado(true)
          return
        }
        form.reset({
          marca: veiculo.marca,
          modelo: veiculo.modelo,
          versao: veiculo.versao ?? undefined,
          ano_fabricacao: veiculo.ano_fabricacao,
          ano_modelo: veiculo.ano_modelo,
          cor: veiculo.cor ?? undefined,
          km: veiculo.km ?? undefined,
          combustivel: (veiculo.combustivel as never) ?? undefined,
          cambio: (veiculo.cambio as never) ?? undefined,
          carroceria: (veiculo.carroceria as never) ?? undefined,
          portas: veiculo.portas ?? undefined,
          placa: veiculo.placa ?? undefined,
          preco: veiculo.preco,
          preco_promocional: veiculo.preco_promocional ?? undefined,
          aceita_troca: veiculo.aceita_troca,
          destaque: veiculo.destaque,
          descricao: veiculo.descricao ?? undefined,
          opcionais: veiculo.opcionais,
          status: veiculo.status as never,
        })
      })
      .catch((e: Error) => setErroSalvar(e.message))
      .finally(() => setCarregandoVeiculo(false))
  }, [id, form])

  if (!user) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  if (carregandoVeiculo) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  if (naoEncontrado) {
    return <p className="text-muted-foreground">Veículo não encontrado.</p>
  }

  async function onSubmit(valores: VeiculoFormValues) {
    setErroSalvar(null)
    setSalvando(true)

    const payload: VeiculoPayload = {
      loja_id: user!.id,
      marca: valores.marca,
      modelo: valores.modelo,
      versao: valores.versao ?? null,
      ano_fabricacao: valores.ano_fabricacao,
      ano_modelo: valores.ano_modelo,
      cor: valores.cor ?? null,
      km: valores.km ?? null,
      combustivel: valores.combustivel ?? null,
      cambio: valores.cambio ?? null,
      carroceria: valores.carroceria ?? null,
      portas: valores.portas ?? null,
      placa: valores.placa ?? null,
      placa_final: derivarPlacaFinal(valores.placa),
      preco: valores.preco,
      preco_promocional: valores.preco_promocional ?? null,
      aceita_troca: valores.aceita_troca,
      destaque: valores.destaque,
      descricao: valores.descricao ?? null,
      opcionais: valores.opcionais,
      status: valores.status,
      fotos: [],
      foto_capa: null,
      titulo: gerarTitulo(valores.marca, valores.modelo, valores.ano_modelo),
    }

    try {
      if (id) {
        await updateVeiculo(id, payload)
      } else {
        await createVeiculo(veiculoId, payload)
      }
      navigate('/veiculos')
    } catch (e) {
      setErroSalvar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{id ? 'Editar veículo' : 'Novo veículo'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="marca">Marca</Label>
              <Input id="marca" {...form.register('marca')} />
              {form.formState.errors.marca && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.marca.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input id="modelo" {...form.register('modelo')} />
              {form.formState.errors.modelo && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.modelo.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ano_fabricacao">Ano de fabricação</Label>
              <Input id="ano_fabricacao" type="number" {...form.register('ano_fabricacao')} />
              {form.formState.errors.ano_fabricacao && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.ano_fabricacao.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ano_modelo">Ano do modelo</Label>
              <Input id="ano_modelo" type="number" {...form.register('ano_modelo')} />
              {form.formState.errors.ano_modelo && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.ano_modelo.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="preco">Preço</Label>
              <Input id="preco" type="number" step="0.01" {...form.register('preco')} />
              {form.formState.errors.preco && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.preco.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="versao">Versão</Label>
              <Input id="versao" {...form.register('versao')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cor">Cor</Label>
              <Input id="cor" {...form.register('cor')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="km">Quilometragem</Label>
              <Input id="km" type="number" {...form.register('km')} />
              {form.formState.errors.km && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.km.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="combustivel">Combustível</Label>
              <Select
                value={form.watch('combustivel') ?? ''}
                onValueChange={(v) => form.setValue('combustivel', v as never)}
              >
                <SelectTrigger id="combustivel">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {COMBUSTIVEL_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cambio">Câmbio</Label>
              <Select
                value={form.watch('cambio') ?? ''}
                onValueChange={(v) => form.setValue('cambio', v as never)}
              >
                <SelectTrigger id="cambio">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {CAMBIO_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="carroceria">Carroceria</Label>
              <Select
                value={form.watch('carroceria') ?? ''}
                onValueChange={(v) => form.setValue('carroceria', v as never)}
              >
                <SelectTrigger id="carroceria">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {CARROCERIA_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="portas">Portas</Label>
              <Input id="portas" type="number" {...form.register('portas')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="placa">Placa</Label>
              <Input id="placa" {...form.register('placa')} />
              {form.formState.errors.placa && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.placa.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="preco_promocional">Preço promocional</Label>
              <Input id="preco_promocional" type="number" step="0.01" {...form.register('preco_promocional')} />
              {form.formState.errors.preco_promocional && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.preco_promocional.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="aceita_troca"
                aria-label="Aceita troca"
                checked={Boolean(form.watch('aceita_troca'))}
                onCheckedChange={(v) => form.setValue('aceita_troca', v)}
              />
              <Label htmlFor="aceita_troca">Aceita troca</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="destaque"
                aria-label="Destaque"
                checked={Boolean(form.watch('destaque'))}
                onCheckedChange={(v) => form.setValue('destaque', v)}
              />
              <Label htmlFor="destaque">Destaque</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as never)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" {...form.register('descricao')} />
            </div>

            <OpcionaisField
              value={form.watch('opcionais') ?? []}
              onChange={(valores) => form.setValue('opcionais', valores)}
            />

            {erroSalvar && (
              <p role="alert" className="text-sm text-destructive">
                {erroSalvar}
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
