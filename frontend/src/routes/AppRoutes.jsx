import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import ErrorBoundary from '../context/ErrorBoundary.jsx';

// Views
import Login from '../views/Login.jsx';
import Dashboard from '../views/Dashboard.jsx';
import EmployeeDashboard from '../views/EmployeeDashboard.jsx';
import MyAttendance from '../views/MyAttendance.jsx';
import BiometricScanner from '../views/BiometricScanner.jsx';
import GeofenceSandbox from '../views/GeofenceSandbox.jsx';
import AdminPanel from '../views/AdminPanel.jsx';
import Profile from '../views/Profile.jsx';

// Role-aware catch-all redirect component
function RoleRedirect() {
  try {
    const raw = localStorage.getItem('quantum_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u?.role === 'admin') return <Navigate to="/dashboard" replace />;
    }
  } catch { /* fall through */ }
  return <Navigate to="/employee-dashboard" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Authentication Layout Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Main Dashboard Layout Protected Routes */}
      <Route element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        {/* Admin-only: Full dashboard */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ErrorBoundary>
              <Dashboard />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Employee landing page */}
        <Route path="/employee-dashboard" element={
          <ErrorBoundary>
            <EmployeeDashboard />
          </ErrorBoundary>
        } />

        {/* Employee attendance history */}
        <Route path="/my-attendance" element={
          <ErrorBoundary>
            <MyAttendance />
          </ErrorBoundary>
        } />

        {/* Scanner — accessible by all authenticated users */}
        <Route path="/scanner" element={
          <ErrorBoundary>
            <BiometricScanner />
          </ErrorBoundary>
        } />

        {/* Admin-only: Geofence sandbox */}
        <Route path="/sandbox" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ErrorBoundary>
              <GeofenceSandbox />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Profile — accessible by all authenticated users */}
        <Route path="/profile" element={
          <ErrorBoundary>
            <Profile />
          </ErrorBoundary>
        } />
        
        {/* Admin-only: Admin control panel */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ErrorBoundary>
              <AdminPanel />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
      </Route>

      {/* Catch-all: redirect based on user role */}
      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}
