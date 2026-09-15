const passos = [
  'Cadastre sua loja e seus veículos.',
  'Ative sua vitrine pública e compartilhe o link.',
  'O agente de IA atende quem chegar pelo WhatsApp.',
  'Acompanhe e feche os leads pelo painel.',
]

export function LandingComoFunciona() {
  return (
    <section className="px-4 py-12">
      <h2 className="mb-6 text-center text-2xl font-semibold">
        Como funciona
      </h2>
      <ol className="mx-auto flex max-w-2xl flex-col gap-4">
        {passos.map((passo, index) => (
          <li key={passo} className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <span>{passo}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
