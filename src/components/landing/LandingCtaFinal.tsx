import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function LandingCtaFinal() {
  return (
    <section className="flex flex-col items-center gap-4 bg-muted px-4 py-16 text-center">
      <h2 className="text-2xl font-semibold">
        Pronto pra automatizar o atendimento da sua revenda?
      </h2>
      <Button size="lg" render={<Link to="/signup" />}>
        Criar conta grátis
      </Button>
    </section>
  )
}
