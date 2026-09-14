import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CorFieldProps {
  id: string
  label: string
  value: string | undefined
  onChange: (valor: string) => void
  error?: string
}

const COR_REGEX = /^#[0-9a-fA-F]{6}$/

export function CorField({ id, label, value, onChange, error }: CorFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Selecionar ${label.toLowerCase()}`}
          value={value && COR_REGEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border"
        />
        <Input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="#1E40AF" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
