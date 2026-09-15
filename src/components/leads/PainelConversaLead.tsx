import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { getInteracoes, setLeadBotAtivo, type Lead, type Interacao } from '@/lib/leads'

const ROTULO_TIPO: Record<string, string> = {
  audioMessage: '🎤 Áudio',
  imageMessage: '🖼️ Imagem',
}

interface PainelConversaLeadProps {
  lead: Lead | null
  onFechar: () => void
  onBotAtivoAlterado: (leadId: string, ativo: boolean) => void
}

export function PainelConversaLead({ lead, onFechar, onBotAtivoAlterado }: PainelConversaLeadProps) {
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [alternandoBot, setAlternandoBot] = useState(false)

  useEffect(() => {
    if (!lead) return
    setCarregando(true)
    setErro(null)
    getInteracoes(lead.id)
      .then(setInteracoes)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [lead])

  async function alternarBot() {
    if (!lead) return
    const novoValor = !lead.bot_ativo
    setAlternandoBot(true)
    setErro(null)
    try {
      await setLeadBotAtivo(lead.id, novoValor)
      onBotAtivoAlterado(lead.id, novoValor)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setAlternandoBot(false)
    }
  }

  return (
    <Sheet
      open={lead !== null}
      onOpenChange={(aberto: boolean) => {
        if (!aberto) onFechar()
      }}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{lead?.nome || lead?.telefone || 'Lead'}</SheetTitle>
        </SheetHeader>

        {erro && (
          <p role="alert" className="px-4 text-sm text-destructive">
            {erro}
          </p>
        )}

        {carregando && <p className="px-4 text-sm text-muted-foreground">Carregando histórico...</p>}

        {!carregando && (
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4">
            {interacoes.map((interacao) => (
              <div
                key={interacao.id}
                className={`max-w-[80%] rounded-md p-2 text-sm ${
                  interacao.remetente === 'LEAD'
                    ? 'self-start bg-muted'
                    : 'self-end bg-primary text-primary-foreground'
                }`}
              >
                {ROTULO_TIPO[interacao.tipo] ?? interacao.conteudo}
              </div>
            ))}
          </div>
        )}

        {lead && (
          <div className="p-4">
            <Button onClick={alternarBot} disabled={alternandoBot} className="w-full">
              {lead.bot_ativo ? 'Assumir conversa' : 'Devolver ao robô'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
