import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/Login'
import SignupPage from '@/pages/Signup'
import DashboardPage from '@/pages/Dashboard'
import VeiculosPage from '@/pages/Veiculos'
import VeiculoFormPage from '@/pages/VeiculoForm'
import ConfiguracoesPage from '@/pages/Configuracoes'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/veiculos"
        element={
          <ProtectedRoute>
            <VeiculosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/veiculos/novo"
        element={
          <ProtectedRoute>
            <VeiculoFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/veiculos/:id/editar"
        element={
          <ProtectedRoute>
            <VeiculoFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute>
            <ConfiguracoesPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
