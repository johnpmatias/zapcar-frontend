import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="flex flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold sm:text-5xl">
        Atendimento automático no WhatsApp pra sua revenda, sem perder nenhum
        lead
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        O ZapCar responde seus clientes pelo WhatsApp com IA, organiza cada
        conversa num CRM visual e ainda gera uma vitrine pública dos seus
        veículos — tudo em um só lugar.
      </p>
      <div className="flex flex-col items-center gap-2">
        <Button size="lg" render={<Link to="/signup" />}>
          Criar conta grátis
        </Button>
        <Link to="/login" className="text-sm text-muted-foreground underline">
          Já tem conta? Entrar
        </Link>
      </div>
    </section>
  )
}
