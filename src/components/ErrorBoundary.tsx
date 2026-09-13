import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Erro capturado pelo ErrorBoundary:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <p className="text-center text-muted-foreground">
            Algo deu errado. Tente recarregar a página.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
