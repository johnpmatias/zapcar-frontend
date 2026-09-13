import { useContext } from 'react'
import { AuthContext } from '@/contexts/auth-context'

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider')
  }
  return context
}
