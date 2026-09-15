import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PublicHomeRoute } from '@/components/PublicHomeRoute'
import { RequireAssinaturaAtiva } from '@/components/RequireAssinaturaAtiva'
import LandingPage from '@/pages/Landing'
import LoginPage from '@/pages/Login'
import SignupPage from '@/pages/Signup'
import DashboardPage from '@/pages/Dashboard'
import VeiculosPage from '@/pages/Veiculos'
import VeiculoFormPage from '@/pages/VeiculoForm'
import ConfiguracoesPage from '@/pages/Configuracoes'
import VitrinePage from '@/pages/Vitrine'
import LeadsPage from '@/pages/Leads'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicHomeRoute>
            <LandingPage />
          </PublicHomeRoute>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/painel"
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
            <RequireAssinaturaAtiva>
              <VeiculoFormPage />
            </RequireAssinaturaAtiva>
          </ProtectedRoute>
        }
      />
      <Route
        path="/veiculos/:id/editar"
        element={
          <ProtectedRoute>
            <RequireAssinaturaAtiva>
              <VeiculoFormPage />
            </RequireAssinaturaAtiva>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsPage />
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
      <Route path="/v/:slug" element={<VitrinePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
