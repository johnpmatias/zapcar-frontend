import { Link } from 'react-router-dom'

export function LandingFooter() {
  return (
    <footer className="flex items-center justify-center gap-4 border-t px-4 py-6 text-sm text-muted-foreground">
      <span>© 2026 ZapCar</span>
      <Link to="/login" className="underline">
        Entrar
      </Link>
    </footer>
  )
}
