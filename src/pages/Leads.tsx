import { useEffect, useState } from 'react'
import { useLeads } from '@/hooks/useLeads'
import { updateLeadTemperatura, type Lead, type TemperaturaLead } from '@/lib/leads'
import { KanbanBoard } from '@/components/leads/KanbanBoard'
import { PainelConversaLead } from '@/components/leads/PainelConversaLead'
import { Button } from '@/components/ui/button'

export default function LeadsPage() {
  const { leads, carregando, erro, recarregar } = useLeads()
  const [leadsExibidos, setLeadsExibidos] = useState<Lead[]>([])
  const [erroMovimento, setErroMovimento] = useState<string | null>(null)
  const [leadSelecionadoId, setLeadSelecionadoId] = useState<string | null>(null)

  useEffect(() => {
    setLeadsExibidos(leads)
  }, [leads])

  async function moverLead(leadId: string, novaTemperatura: TemperaturaLead) {
    const anterior = leadsExibidos
    setErroMovimento(null)
    setLeadsExibidos((atual) => atual.map((l) => (l.id === leadId ? { ...l, temperatura: novaTemperatura } : l)))

    try {
      await updateLeadTemperatura(leadId, novaTemperatura)
    } catch (e) {
      setLeadsExibidos(anterior)
      setErroMovimento((e as Error).message)
    }
  }

  function botAtivoAlterado(leadId: string, ativo: boolean) {
    setLeadsExibidos((atual) => atual.map((l) => (l.id === leadId ? { ...l, bot_ativo: ativo } : l)))
  }

  const leadSelecionado = leadsExibidos.find((l) => l.id === leadSelecionadoId) ?? null

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">CRM</h1>

      {carregando && <p className="text-muted-foreground">Carregando...</p>}

      {!carregando && erro && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
          <Button variant="outline" onClick={recarregar}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!carregando && !erro && (
        <>
          {erroMovimento && (
            <p role="alert" className="text-sm text-destructive">
              {erroMovimento}
            </p>
          )}
          <KanbanBoard leads={leadsExibidos} onMoverLead={moverLead} onAbrirLead={(lead) => setLeadSelecionadoId(lead.id)} />
        </>
      )}

      <PainelConversaLead
        lead={leadSelecionado}
        onFechar={() => setLeadSelecionadoId(null)}
        onBotAtivoAlterado={botAtivoAlterado}
      />
    </div>
  )
}
