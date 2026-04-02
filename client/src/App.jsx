import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DeviceProvider } from './context/DeviceContext';
import { DashboardProvider } from './context/DashboardContext';
import { HistoricalProvider } from './context/HistoricalContext';
import { LiveProvider } from './context/LiveContext';
import { InsightsProvider } from './context/InsightsContext';
import { AlertsProvider } from './context/AlertsContext';
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
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DeviceProvider>
                  <LiveProvider>
                    <DashboardProvider>
                      <HistoricalProvider>
                        <InsightsProvider>
                          <AlertsProvider>
                            <AppLayout />
                          </AlertsProvider>
                        </InsightsProvider>
                      </HistoricalProvider>
                    </DashboardProvider>
                  </LiveProvider>
                </DeviceProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="historical" element={<HistoricalPage />} />
            <Route path="live" element={<LivePage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="alerts" element={<AlertsPage />} />

            <Route
              path="admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
