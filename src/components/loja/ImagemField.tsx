import { useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { uploadImagemLoja, removerImagemLoja } from '@/lib/loja-imagens'

interface ImagemFieldProps {
  lojaId: string
  campo: string
  label: string
  value: string | undefined
  onChange: (url: string | undefined) => void
}

export function ImagemField({ lojaId, campo, label, value, onChange }: ImagemFieldProps) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return

    setErro(null)
    setEnviando(true)
    try {
      const url = await uploadImagemLoja(lojaId, campo, arquivo)
      onChange(url)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function remover() {
    if (!value) return
    await removerImagemLoja(value)
    onChange(undefined)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`imagem-${campo}`}>{label}</Label>
      {value && (
        <div className="flex flex-col items-start gap-2">
          <img src={value} alt={label} className="h-24 w-auto rounded object-cover" />
          <Button type="button" variant="destructive" size="xs" onClick={remover}>
            Remover
          </Button>
        </div>
      )}
      <input id={`imagem-${campo}`} type="file" accept="image/*" onChange={aoSelecionarArquivo} disabled={enviando} />
      {enviando && <p className="text-sm text-muted-foreground">Enviando...</p>}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}
