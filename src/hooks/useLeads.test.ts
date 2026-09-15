import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLeads } from './useLeads'
import { getLeads } from '@/lib/leads'

vi.mock('@/lib/leads', () => ({
  getLeads: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getLeads).mockReset()
})

describe('useLeads', () => {
  it('carrega os leads ao montar', async () => {
    vi.mocked(getLeads).mockResolvedValue([{ id: '1' } as never])

    const { result } = renderHook(() => useLeads())

    expect(result.current.carregando).toBe(true)
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.leads).toEqual([{ id: '1' }])
    expect(result.current.erro).toBeNull()
  })

  it('expõe o erro quando a busca falha', async () => {
    vi.mocked(getLeads).mockRejectedValue(new Error('falha de rede'))

    const { result } = renderHook(() => useLeads())

    await waitFor(() => expect(result.current.erro).toBe('falha de rede'))
  })

  it('recarrega ao chamar recarregar', async () => {
    vi.mocked(getLeads).mockResolvedValue([])
    const { result } = renderHook(() => useLeads())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    result.current.recarregar()

    expect(vi.mocked(getLeads)).toHaveBeenCalledTimes(2)
  })
})
