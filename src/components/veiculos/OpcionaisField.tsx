import { useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface OpcionaisFieldProps {
  value: string[]
  onChange: (valores: string[]) => void
}

export function OpcionaisField({ value, onChange }: OpcionaisFieldProps) {
  const [texto, setTexto] = useState('')

  function adicionar() {
    const item = texto.trim()
    if (!item) return
    onChange([...value, item])
    setTexto('')
  }

  function remover(item: string) {
    onChange(value.filter((v) => v !== item))
  }

  function aoPressionarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      adicionar()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="opcional-novo" className="text-sm font-medium">
        Adicionar opcional
      </label>
      <Input
        id="opcional-novo"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={aoPressionarTecla}
        placeholder="Ex: Ar condicionado"
      />
      <div className="flex flex-wrap gap-2">
        {value.map((item) => (
          <Badge key={item} variant="secondary" className="gap-1">
            {item}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Remover ${item}`}
              onClick={() => remover(item)}
            >
              ×
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  )
}
