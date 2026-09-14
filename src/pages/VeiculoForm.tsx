import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { veiculoSchema, type VeiculoFormValues } from '@/lib/veiculo-schema'
import { gerarTitulo, derivarPlacaFinal } from '@/lib/veiculo-helpers'
import { createVeiculo, type VeiculoPayload } from '@/lib/veiculos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const valoresIniciais: VeiculoFormValues = {
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

  const form = useForm<VeiculoFormValues>({
    resolver: zodResolver(veiculoSchema),
    defaultValues: valoresIniciais,
  })

  if (!user) {
    return <p className="text-muted-foreground">Carregando...</p>
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
      await createVeiculo(veiculoId, payload)
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
          <CardTitle>Novo veículo</CardTitle>
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
