import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import VeiculosPage from '@/pages/Veiculos'
import { listVeiculos, deleteVeiculo, reorderVeiculos } from '@/lib/veiculos'

vi.mock('@/lib/veiculos', () => ({
  listVeiculos: vi.fn(),
  deleteVeiculo: vi.fn(),
  reorderVeiculos: vi.fn(),
}))

// dnd-kit mede a posição de cada item arrastável via getBoundingClientRect
// pra decidir, ao pressionar uma seta, qual é o "próximo" item na direção
// pressionada — ver a mesma explicação em ListaReordenavel.test.tsx.
function mockarRetangulos() {
  const alturaItem = 50
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const itensNoDom = Array.from(document.querySelectorAll<HTMLElement>('li'))
    const indice = itensNoDom.indexOf(this)
    const topo = indice >= 0 ? indice * alturaItem : 0
    return {
      width: 300,
      height: alturaItem,
      top: topo,
      left: 0,
      right: 300,
      bottom: topo + alturaItem,
      x: 0,
      y: topo,
      toJSON() {},
    } as DOMRect
  })
}

beforeEach(() => {
  vi.mocked(listVeiculos).mockReset()
  vi.mocked(deleteVeiculo).mockReset()
  vi.mocked(reorderVeiculos).mockReset()
  vi.restoreAllMocks()
})

function renderPagina() {
  return render(
    <MemoryRouter>
      <VeiculosPage />
    </MemoryRouter>
  )
}

describe('VeiculosPage', () => {
  it('mostra estado de carregamento e depois a lista', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      {
        id: '1',
        marca: 'Honda',
        modelo: 'Civic',
        ano_modelo: 2024,
        preco: 95000,
        status: 'disponivel',
      } as never,
    ])

    renderPagina()

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(await screen.findByText('Honda')).toBeInTheDocument()
    expect(screen.getByText('Civic')).toBeInTheDocument()
  })

  it('mostra mensagem de vazio quando não há veículos', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([])

    renderPagina()

    expect(await screen.findByText(/nenhum veículo cadastrado/i)).toBeInTheDocument()
  })

  it('mostra erro com botão de tentar novamente', async () => {
    vi.mocked(listVeiculos).mockRejectedValue(new Error('falha de rede'))

    renderPagina()

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('falha de rede')
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it('exclui um veículo após confirmação', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel' } as never,
    ])
    vi.mocked(deleteVeiculo).mockResolvedValue(undefined)
    const usuario = userEvent.setup()

    renderPagina()

    await usuario.click(await screen.findByRole('button', { name: /excluir/i }))
    await usuario.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    expect(deleteVeiculo).toHaveBeenCalledWith('1')
  })

  it('separa os veículos em seções de Disponíveis e Vendidos/Inativos', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel' } as never,
      { id: '2', marca: 'Toyota', modelo: 'Corolla', ano_modelo: 2022, preco: 90000, status: 'vendido' } as never,
    ])

    renderPagina()

    expect(await screen.findByText('Honda')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /disponíveis/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /vendidos\/inativos/i })).toBeInTheDocument()
    expect(screen.getByText('Toyota')).toBeInTheDocument()
  })

  it('não mostra a seção Vendidos/Inativos quando não há nenhum', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel' } as never,
    ])

    renderPagina()

    await screen.findByText('Honda')
    expect(screen.queryByRole('heading', { name: /vendidos\/inativos/i })).not.toBeInTheDocument()
  })

  it('mostra mensagem quando só há veículos indisponíveis pra reordenar', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Toyota', modelo: 'Corolla', ano_modelo: 2022, preco: 90000, status: 'inativo' } as never,
    ])

    renderPagina()

    expect(await screen.findByText(/nenhum veículo disponível pra reordenar/i)).toBeInTheDocument()
  })

  it('reordena via teclado, mostra "Salvando ordem..." durante o salvamento e persiste a nova ordem', async () => {
    mockarRetangulos()
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel', ordem: 0 } as never,
      { id: '2', marca: 'Toyota', modelo: 'Corolla', ano_modelo: 2022, preco: 90000, status: 'disponivel', ordem: 1 } as never,
    ])
    // Promise controlada manualmente (em vez de mockResolvedValue) pra poder
    // observar de forma determinística o indicador "Salvando ordem..." tanto
    // presente (enquanto pendente) quanto ausente (depois de resolvida), sem
    // depender de timing de uma promise que já nasce resolvida.
    let resolverReorder: () => void = () => {}
    vi.mocked(reorderVeiculos).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverReorder = () => resolve(undefined)
        })
    )

    renderPagina()
    await screen.findByText('Honda')

    const [alcaPrimeiro] = screen.getAllByRole('button', { name: /arrastar para reordenar/i })
    alcaPrimeiro.focus()

    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(alcaPrimeiro, { code: 'ArrowDown' })
    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })

    await waitFor(() =>
      expect(reorderVeiculos).toHaveBeenCalledWith([
        { id: '2', ordem: 0 },
        { id: '1', ordem: 1 },
      ])
    )

    // dnd-kit também expõe sua própria região role="status" (live region de
    // anúncios de drag-and-drop, sem nome acessível calculável a partir do
    // conteúdo) — por isso filtra os elementos com essa role pelo texto do
    // indicador da página em vez de usar a opção `name`.
    const indicadorSalvando = () =>
      screen.queryAllByRole('status').filter((el) => /salvando ordem/i.test(el.textContent ?? ''))

    expect(indicadorSalvando()).toHaveLength(1)

    resolverReorder()

    await waitFor(() => expect(indicadorSalvando()).toHaveLength(0))
  })

  it('mostra erro e re-sincroniza com a ordem real do servidor quando falha ao salvar', async () => {
    mockarRetangulos()
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel', ordem: 0 } as never,
      { id: '2', marca: 'Toyota', modelo: 'Corolla', ano_modelo: 2022, preco: 90000, status: 'disponivel', ordem: 1 } as never,
    ])
    vi.mocked(reorderVeiculos).mockRejectedValue(new Error('falha de rede'))

    renderPagina()
    await screen.findByText('Honda')

    const [alcaPrimeiro] = screen.getAllByRole('button', { name: /arrastar para reordenar/i })
    alcaPrimeiro.focus()

    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(alcaPrimeiro, { code: 'ArrowDown' })
    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('falha de rede')

    // reorderVeiculos falhou no meio do Promise.all; em vez de confiar no
    // estado pré-drag, o componente busca a ordem real no servidor
    // (listVeiculos, aqui ainda mockado com a ordem original) e é essa
    // busca — não uma reversão local cega — que explica a lista voltar a
    // Honda/Toyota.
    const linhas = await screen.findAllByRole('listitem')
    expect(linhas[0].textContent).toContain('Honda')
    expect(linhas[1].textContent).toContain('Toyota')
  })
})
