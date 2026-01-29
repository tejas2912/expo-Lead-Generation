import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Role-based Route component
const RoleRoute = ({ children, roles }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
};

// Lazy load components
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const CompaniesPage = React.lazy(() => import('./pages/CompaniesPage'));
const UsersPage = React.lazy(() => import('./pages/UsersPage'));
const EmployeesPage = React.lazy(() => import('./pages/EmployeesPage'));
const CompanyAdminsPage = React.lazy(() => import('./pages/CompanyAdminsPage'));
const VisitorsPage = React.lazy(() => import('./pages/VisitorsPage'));
const LeadsPage = React.lazy(() => import('./pages/LeadsPage'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* Platform Admin only routes */}
        <Route path="companies" element={
          <RoleRoute roles={['platform_admin']}>
            <CompaniesPage />
          </RoleRoute>
        } />
        <Route path="users" element={
          <RoleRoute roles={['platform_admin']}>
            <UsersPage />
          </RoleRoute>
        } />
        <Route path="company-admins" element={
          <RoleRoute roles={['platform_admin']}>
            <CompanyAdminsPage />
          </RoleRoute>
        } />
        
        {/* Company Admin only routes */}
        <Route path="employees" element={
          <RoleRoute roles={['company_admin']}>
            <EmployeesPage />
          </RoleRoute>
        } />
        
        {/* Shared routes */}
        <Route path="visitors" element={
          <RoleRoute roles={['platform_admin', 'company_admin']}>
            <VisitorsPage />
          </RoleRoute>
        } />
        <Route path="leads" element={
          <RoleRoute roles={['platform_admin', 'company_admin', 'employee']}>
            <LeadsPage />
          </RoleRoute>
        } />
        <Route path="analytics" element={
          <RoleRoute roles={['platform_admin', 'company_admin']}>
            <AnalyticsPage />
          </RoleRoute>
        } />
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      
      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          }>
            <AppRoutes />
          </React.Suspense>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
