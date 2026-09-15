import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const features = [
  {
    titulo: 'Atendimento com IA no WhatsApp',
    descricao:
      'Um agente de IA conversa com seus clientes 24 horas por dia, tira dúvidas sobre os veículos e sabe a hora certa de te chamar pra fechar a venda.',
  },
  {
    titulo: 'CRM visual de leads',
    descricao:
      'Todos os contatos organizados num quadro Kanban por temperatura — frio, morno, quente — com o histórico completo de cada conversa.',
  },
  {
    titulo: 'Vitrine pública dos veículos',
    descricao:
      'Uma página com seu estoque disponível, pronta pra compartilhar, com botão direto de WhatsApp pra cada carro.',
  },
]

export function LandingFeatures() {
  return (
    <section className="grid gap-4 px-4 py-12 sm:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.titulo}>
          <CardHeader>
            <CardTitle>{feature.titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {feature.descricao}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
