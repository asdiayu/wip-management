import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import { ThemeProvider } from './context/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Initialize QueryClient for caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10, // Data dianggap fresh hanya selama 10 detik (lebih responsif)
      gcTime: 1000 * 60 * 30, 
      retry: 1,
      refetchOnWindowFocus: true, // Tarik data baru jika user berpindah tab dan kembali lagi
    },
  },
});

// Lazy Load Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const InputMaterial = lazy(() => import('./pages/InputMaterial'));
const OutputMaterial = lazy(() => import('./pages/OutputMaterial'));
const Report = lazy(() => import('./pages/Report'));
const Login = lazy(() => import('./pages/Login'));
const MasterData = lazy(() => import('./pages/MasterData'));
const Stock = lazy(() => import('./pages/Stock'));
const DatabaseManagement = lazy(() => import('./pages/DatabaseManagement'));
const QRCodeGenerator = lazy(() => import('./pages/QRCodeGenerator'));
const StockOpname = lazy(() => import('./pages/StockOpname'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const StockTransfer = lazy(() => import('./pages/StockTransfer'));
const ReturnMaterial = lazy(() => import('./pages/ReturnMaterial'));
const Analytics = lazy(() => import('./pages/Analytics'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactElement, allowedRoles?: ('admin' | 'operator' | 'manager' | 'viewer')[] }> = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  const userRole = user.app_metadata?.role || user.user_metadata?.role;
  if (allowedRoles && (!userRole || !allowedRoles.includes(userRole))) {
    if (userRole === 'operator') return <Navigate to="/input" replace />;
    if (userRole === 'manager') return <Navigate to="/dashboard" replace />;
    if (userRole === 'viewer') return <Navigate to="/stock" replace />;
    return <Navigate to="/" replace />;
  }
  return children;
};

const AppRoutes: React.FC = () => {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'operator', 'manager', 'viewer']}><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
            <Route path="/input" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><MainLayout><InputMaterial /></MainLayout></ProtectedRoute>} />
            <Route path="/output" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><MainLayout><OutputMaterial /></MainLayout></ProtectedRoute>} />
            <Route path="/stock-transfer" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><MainLayout><StockTransfer /></MainLayout></ProtectedRoute>} />
            <Route path="/return" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><MainLayout><ReturnMaterial /></MainLayout></ProtectedRoute>} />
            <Route path="/stock" element={<ProtectedRoute allowedRoles={['admin', 'operator', 'manager', 'viewer']}><MainLayout><Stock /></MainLayout></ProtectedRoute>} />
            <Route path="/stock-opname" element={<ProtectedRoute allowedRoles={['admin', 'operator', 'manager']}><MainLayout><StockOpname /></MainLayout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><MainLayout><Analytics /></MainLayout></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute allowedRoles={['admin', 'operator', 'manager']}><MainLayout><Report /></MainLayout></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><MainLayout><AuditLogs /></MainLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><MainLayout><UserManagement /></MainLayout></ProtectedRoute>} />
            <Route path="/master-data" element={<ProtectedRoute allowedRoles={['admin']}><MainLayout><MasterData /></MainLayout></ProtectedRoute>} />
            <Route path="/qr-generator" element={<ProtectedRoute allowedRoles={['admin']}><MainLayout><QRCodeGenerator /></MainLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
            <Route path="/database-management" element={<ProtectedRoute allowedRoles={['admin']}><MainLayout><DatabaseManagement /></MainLayout></ProtectedRoute>} />
        </Routes>
      </Suspense>
    );
}

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
          <AuthProvider>
          <HashRouter>
              <AppRoutes />
          </HashRouter>
          </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;