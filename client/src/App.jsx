import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DeviceProvider } from './context/DeviceContext';
import { DashboardProvider } from './context/DashboardContext';
import { HistoricalProvider } from './context/HistoricalContext';
import { LiveProvider } from './context/LiveContext';
import { InsightsProvider } from './context/InsightsContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import HistoricalPage from './pages/HistoricalPage';
import LivePage from './pages/LivePage';
import InsightsPage from './pages/InsightsPage';
import AlertsPage from './pages/AlertsPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public route — no DeviceProvider here (avoids /devices before login) */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes — devices only load after auth gate */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DeviceProvider>
                  <LiveProvider>
                    <AppLayout />
                  </LiveProvider>
                </DeviceProvider>
              </ProtectedRoute>
            }
          >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route
                path="dashboard"
                element={
                  <DashboardProvider>
                    <DashboardPage />
                  </DashboardProvider>
                }
              />
              <Route
                path="historical"
                element={
                  <HistoricalProvider>
                    <HistoricalPage />
                  </HistoricalProvider>
                }
              />
              <Route path="live" element={<LivePage />} />
              <Route
                path="insights"
                element={
                  <InsightsProvider>
                    <InsightsPage />
                  </InsightsProvider>
                }
              />
              <Route path="alerts" element={<AlertsPage />} />

              {/* Admin-only route */}
              <Route
                path="admin"
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
