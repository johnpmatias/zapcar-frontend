import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PLACA_REGEX } from '@/lib/veiculo-schema'

interface VersaoFipe {
  texto: string
  valorFipe: number
  score: number
}

interface DadosPlaca {
  marca: string
  modelo: string
  anoFabricacao: number
  anoModelo: number
  cor?: string
  combustivel?: string
  cambio?: string
  carroceria?: string
  versoes: VersaoFipe[]
}

interface DadosEncontrados {
  marca: string
  modelo: string
  anoFabricacao: number
  anoModelo: number
  cor?: string
  combustivel?: string
  cambio?: string
  carroceria?: string
  versao?: string
  valorFipeReferencia?: number
}

interface PlacaLookupProps {
  placaAtual: string
  onDadosEncontrados: (dados: DadosEncontrados) => void
}

const MENSAGENS_ERRO: Record<string, string> = {
  placa_invalida: 'Placa inválida. Confira o formato digitado.',
  nao_encontrada: 'Placa não encontrada. Preencha os dados manualmente.',
  token_invalido: 'Consulta indisponível no momento. Preencha os dados manualmente.',
  limite_excedido: 'Consulta indisponível no momento. Preencha os dados manualmente.',
  indisponivel: 'Consulta indisponível no momento. Preencha os dados manualmente.',
}

export function PlacaLookup({ placaAtual, onDadosEncontrados }: PlacaLookupProps) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosPlaca | null>(null)
  const [versaoSelecionada, setVersaoSelecionada] = useState<VersaoFipe | null>(null)

  function aplicar(dadosBase: DadosPlaca, versao?: VersaoFipe) {
    onDadosEncontrados({
      marca: dadosBase.marca,
      modelo: dadosBase.modelo,
      anoFabricacao: dadosBase.anoFabricacao,
      anoModelo: dadosBase.anoModelo,
      cor: dadosBase.cor,
      combustivel: dadosBase.combustivel,
      cambio: dadosBase.cambio,
      carroceria: dadosBase.carroceria,
      versao: versao?.texto,
      valorFipeReferencia: versao?.valorFipe,
    })
  }

  async function buscar() {
    setErro(null)
    setDados(null)
    setVersaoSelecionada(null)

    const placaNormalizada = placaAtual.trim().toUpperCase()
    if (!PLACA_REGEX.test(placaNormalizada)) {
      setErro(MENSAGENS_ERRO.placa_invalida)
      return
    }

    setCarregando(true)
    try {
      const resposta = await fetch(`/api/consulta-placa?placa=${encodeURIComponent(placaNormalizada)}`)
      const corpo = await resposta.json()

      if (!corpo.ok) {
        setErro(MENSAGENS_ERRO[corpo.error] ?? MENSAGENS_ERRO.indisponivel)
        return
      }

      const dadosRecebidos = corpo.data as DadosPlaca
      setDados(dadosRecebidos)
      if (dadosRecebidos.versoes.length <= 1) {
        aplicar(dadosRecebidos, dadosRecebidos.versoes[0])
      } else {
        setVersaoSelecionada(dadosRecebidos.versoes[0])
      }
    } catch {
      setErro(MENSAGENS_ERRO.indisponivel)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" disabled={carregando || !placaAtual} onClick={buscar}>
        {carregando ? 'Buscando...' : 'Buscar dados'}
      </Button>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {dados && dados.versoes.length > 1 && (
        <div className="flex flex-col gap-2 rounded border p-3">
          <p className="text-sm font-medium">Dados encontrados — selecione a versão correta:</p>
          {dados.versoes.map((versao) => (
            <label key={versao.texto} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="versao-fipe"
                checked={versaoSelecionada?.texto === versao.texto}
                onChange={() => setVersaoSelecionada(versao)}
              />
              <span>
                <span>{versao.texto}</span> — Fipe:{' '}
                {versao.valorFipe != null ? versao.valorFipe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
              </span>
            </label>
          ))}
          <Button
            type="button"
            size="sm"
            className="self-start"
            onClick={() => aplicar(dados, versaoSelecionada ?? dados.versoes[0])}
          >
            Usar esta versão
          </Button>
        </div>
      )}

      {dados && dados.versoes.length <= 1 && <p className="text-sm text-muted-foreground">Dados encontrados.</p>}
    </div>
  )
}
