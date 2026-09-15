import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CardVeiculo } from './CardVeiculo'
import type { Veiculo } from '@/lib/veiculos'

const veiculoBase: Veiculo = {
  id: '1',
  loja_id: 'loja-1',
  marca: 'Chevrolet',
  modelo: 'Onix',
  versao: '1.0 Turbo',
  ano_fabricacao: 2022,
  ano_modelo: 2022,
  cor: null,
  km: 42000,
  combustivel: null,
  cambio: null,
  carroceria: null,
  portas: null,
  placa: null,
  placa_final: null,
  preco: 62900,
  preco_promocional: null,
  aceita_troca: false,
  destaque: false,
  descricao: null,
  opcionais: [],
  status: 'disponivel',
  fotos: ['https://exemplo.com/foto1.jpg'],
  foto_capa: null,
  titulo: 'Chevrolet Onix 1.0 Turbo',
  ordem: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('CardVeiculo', () => {
  it('mostra os dados principais do veículo', () => {
    render(<CardVeiculo veiculo={veiculoBase} numeroWhatsapp="5511999998888" />)

    expect(screen.getByText('Chevrolet Onix 1.0 Turbo')).toBeInTheDocument()
    expect(screen.getByText(/42\.000 km/)).toBeInTheDocument()
    expect(screen.getByText('R$ 62.900,00')).toBeInTheDocument()
  })

  it('risca o preço original e mostra o promocional quando houver', () => {
    render(
      <CardVeiculo veiculo={{ ...veiculoBase, preco_promocional: 59900 }} numeroWhatsapp="5511999998888" />
    )

    expect(screen.getByText('R$ 62.900,00')).toHaveClass('line-through')
    expect(screen.getByText('R$ 59.900,00')).toBeInTheDocument()
  })

  it('mostra o badge "Reservado" quando o status é reservado', () => {
    render(<CardVeiculo veiculo={{ ...veiculoBase, status: 'reservado' }} numeroWhatsapp="5511999998888" />)

    expect(screen.getByText('Reservado')).toBeInTheDocument()
  })

  it('não mostra o badge quando o status é disponível', () => {
    render(<CardVeiculo veiculo={veiculoBase} numeroWhatsapp="5511999998888" />)

    expect(screen.queryByText('Reservado')).not.toBeInTheDocument()
  })

  it('monta o link de WhatsApp com a mensagem do veículo', () => {
    render(<CardVeiculo veiculo={veiculoBase} numeroWhatsapp="5511999998888" />)

    const link = screen.getByRole('link', { name: /falar no whatsapp/i })
    const mensagem = 'Olá! Vi o anúncio do Chevrolet Onix 2022 na vitrine e gostaria de mais informações.'
    expect(link.getAttribute('href')).toBe(`https://wa.me/5511999998888?text=${encodeURIComponent(mensagem)}`)
  })

  it('esconde o botão de WhatsApp quando não há número válido', () => {
    render(<CardVeiculo veiculo={veiculoBase} numeroWhatsapp={null} />)

    expect(screen.queryByRole('link', { name: /falar no whatsapp/i })).not.toBeInTheDocument()
  })
})
